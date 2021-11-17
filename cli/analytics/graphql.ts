import { checkMatches } from '../../common/check.ts';

export class GraphqlQuery {
    private readonly _parent: GraphqlQuery[];
    private readonly _nodes: Map<string, Node>;
    private readonly _nodeOrder: string[];
    private readonly _args: Map<string, string>;
    private readonly _argOrder: string[];

    private constructor(parent: GraphqlQuery[], nodes: Map<string, Node>, nodeOrder: string[], args: Map<string, string>, argOrder: string[]) {
        this._parent = parent;
        this._nodes = nodes;
        this._nodeOrder = nodeOrder;
        this._args = args;
        this._argOrder = argOrder;
    }

    static create(): GraphqlQuery {
        return new GraphqlQuery([], new Map(), [], new Map(), []);
    }

    scalar(name: string): GraphqlQuery {
        this.add(name, NodeKind.Scalar);
        return this;
    }

    object(name: string): GraphqlQuery {
        const node = this.add(name, NodeKind.Object);
        const rt = new GraphqlQuery([ this ], new Map(), [], new Map(), []);
        node.query.push(rt);
        return rt;
    }

    objectQuery(name: string, query: GraphqlQuery): GraphqlQuery {
        const node = this.add(name, NodeKind.Object);
        const q = query.copyWithParent(this);
        const rt = q;
        node.query.push(rt);
        return rt;
    }

    argRaw(name: string, rawValue: string): GraphqlQuery {
        return this.addArg(name, rawValue);
    }

    argBoolean(name: string, value: boolean): GraphqlQuery {
        return this.addArg(name, value ? 'true' : 'false');
    }

    argLong(name: string, value: number): GraphqlQuery {
        return this.addArg(name, `${value}`);
    }

    argString(name: string, value: string): GraphqlQuery {
        return this.addArg(name, `"${value.replaceAll('"', '\\"')}"`);
    }

    argObject(name: string, fieldName: string, fieldValue: string): GraphqlQuery {
        return this.addArg(name, `{${fieldName}:"${fieldValue.replaceAll('"', '\\"')}"}`);
    }

    argVariable(name: string, variableName: string): GraphqlQuery {
        checkMatches('variableName', variableName, /^[a-z]+$/);
        return this.addArg(name, `$${variableName}`);
    }

    end(): GraphqlQuery {
        return this._parent.length > 0 ? this._parent[0] : this;
    }

    top(): GraphqlQuery {
        // deno-lint-ignore no-this-alias
        let rt: GraphqlQuery = this;
        while (rt._parent.length > 0) {
            rt = rt._parent[0];
        }
        return rt
    }

    toString(): string {
        const lines: string[] = [];
        lines.push('{');
        this.write(lines, 1);
        lines.push('}');
        return lines.join('\n');
    }

    //

    private addArg(name: string, value: string): GraphqlQuery {
        if (this._args.has(name)) throw new Error(`Duplicate arg: ${name}`);
        this._argOrder.push(name);
        this._args.set(name, value);
        return this;
    }

    private write(lines: string[], level: number) {
        const indent = '  '.repeat(level);
        for (const key of this._nodeOrder) {
            const node = checkGet('_nodes', this._nodes, key);
            if (node.kind === NodeKind.Scalar) {
                lines.push(`${indent}${key}`);
            } else if (node.kind === NodeKind.Object) {
                const q = node.query[0];
                let line = `${indent}${key}`;
                if (q._argOrder.length > 0) {
                    line += '(';
                    let j = 0;
                    for (const argName of q._argOrder) {
                        if (j > 0) line += ', ';
                        line += `${argName}: ${checkGet('q._args', q._args, argName)}`;
                        j++;
                    }
                    line += ')';
                }
                line += ' {';
                lines.push(line);
                node.query[0].write(lines, level + 1);
                lines.push(`${indent}}`);
            } else {
                throw new Error(`Implement node kind ${node.kind}`);
            }
        }
    }

    private add(name: string, kind: NodeKind): Node {
        if (this._nodes.has(name)) throw new Error(`Duplicate field: ${name}`);
        const rt = new Node(kind);
        this._nodes.set(name, rt)
        this._nodeOrder.push(name);
        return rt;
    }

    private copyWithParent(parent: GraphqlQuery): GraphqlQuery {
        const nodes = new Map<string, Node>();
        const nodeOrder = [...this._nodeOrder];
        const args = new Map<string, string>();
        for (const [ key, value ] of this._args.entries()) {
            args.set(key, value);
        }
        const argOrder = [...this._argOrder];
        
        const rt = new GraphqlQuery([ parent ], nodes, nodeOrder, args, argOrder);
        for (const [ key, node ] of this._nodes.entries()) {
            const newNode = new Node(node.kind);
            if (node.query.length > 0) {
                const newQuery = node.query[0].copyWithParent(rt);
                newNode.query.push(newQuery);
            }
            nodes.set(key, newNode);
        }
        return rt;
    }

}

//

function checkGet<T>(mapName: string, map: Map<string, T>, key: string): T {
    const rt = map.get(key);
    if (!rt) throw new Error(`Bad ${mapName}.key: ${key}`);
    return rt;
}

//

enum NodeKind {
    Scalar = 1,
    Object = 2,
}

class Node {
    readonly kind: NodeKind;
    readonly query: GraphqlQuery[] = [];

    constructor(kind: NodeKind) {
        this.kind = kind;
    }

}
