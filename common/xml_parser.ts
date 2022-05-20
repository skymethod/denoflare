import { checkEqual } from './check.ts';
import { getTraversalObj } from './deps_xml.ts';
import { decodeXml } from './xml_util.ts';

export function parseXml(xml: string): ExtendedXmlNode {
    const rt = getTraversalObj(xml, { ignoreAttributes: false, parseAttributeValue: false, parseNodeValue: false, tagValueProcessor: decodeXml }) as XmlNode;
    const namespaces = new XmlNamespaces();
    applyQnames(rt, namespaces);
    checkEqual('namespaces.stackSize', namespaces.stackSize, 0);
    return rt as ExtendedXmlNode;
}

export function computeAttributeMap(attrsMap: Record<string, string> | undefined): ReadonlyMap<string, string> {
    let map: Map<string, string> | undefined;
    if (attrsMap) {
        for (const [ name, value ] of Object.entries(attrsMap)) {
            if (!name.startsWith('@_')) throw new Error(`Bad attrsMap name: ${name}, ${attrsMap}`);
            map = map || new Map<string, string>();
            map.set(name.substring(2), value);
        }
    }
    return map || EMPTY_STRING_MAP;
}

export function findChildElements(node: ExtendedXmlNode, ...qnames: readonly Qname[]): readonly ExtendedXmlNode[] {
    let rt: ExtendedXmlNode[] | undefined;
    for (const value of Object.values(node.child)) {
        for (const qname of qnames) {
            for (const child of value) {
                const extChild = child as ExtendedXmlNode;
                if (qname.name === '*' ? qname.namespaceUri === extChild.qname.namespaceUri : qnameEq(qname, extChild.qname)) {
                    rt = rt || [];
                    rt.push(extChild);
                }
            }
        }
    }
    return rt || EMPTY_XML_NODE_ARRAY;
}

export function findElementRecursive(root: ExtendedXmlNode, test: (node: ExtendedXmlNode) => boolean): ExtendedXmlNode | undefined {
    if (test(root)) return root;
    for (const value of Object.values(root.child)) {
        for (const child of value) {
            const extChild = child as ExtendedXmlNode;
            const rt = findElementRecursive(extChild, test);
            if (rt) return rt;
        }
    }
    return undefined;
}

export function findElementsRecursive(root: ExtendedXmlNode, test: (node: ExtendedXmlNode) => boolean): readonly ExtendedXmlNode[] {
    const rt: ExtendedXmlNode[] = [];
    const collectElements = (node: ExtendedXmlNode) => {
        if (test(node)) rt.push(node);
        for (const value of Object.values(node.child)) {
            for (const child of value) {
                const extChild = child as ExtendedXmlNode;
                collectElements(extChild);
            }
        }
    }
    collectElements(root);
    return rt;
}

export function qnameEq(lhs: Qname, rhs: Qname): boolean {
    return lhs.name === rhs.name && lhs.namespaceUri === rhs.namespaceUri;
}

export function qnamesInclude(lhs: readonly Qname[], rhs: Qname): boolean {
    return lhs.some(v => qnameEq(v, rhs));
}

//

export interface Qname {
    readonly name: string;
    readonly namespaceUri?: string;
}

// fast-xml-parser getTraversalObj return object structure
export interface XmlNode {
    readonly tagname: string; // !xml for top-level
    readonly attrsMap: Record<string, string>; // e.g. @_version: "2.0", @_xmlns:itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd"
    readonly child: Record<string, XmlNode[]>;
    readonly parent?: XmlNode;
    readonly val?: string;
}

// our additions to each node: clean attribute map, and fq element name
export type ExtendedXmlNode = XmlNode & {
    readonly atts: ReadonlyMap<string, string>;
    readonly qname: Qname;
};

//

const EMPTY_STRING_MAP: ReadonlyMap<string, string> = new Map<string, string>();
const EMPTY_XML_NODE_ARRAY: readonly ExtendedXmlNode[] = [];

function applyQnames(node: XmlNode, namespaces: XmlNamespaces) {
    try {
        const atts = namespaces.push(node.attrsMap);
        // deno-lint-ignore no-explicit-any
        const nodeAsAny = node as any;
        nodeAsAny.atts = atts;
        nodeAsAny.qname = computeQname(node.tagname, namespaces);
        for (const value of Object.values(node.child)) {
            for (const childNode of value) {
                applyQnames(childNode, namespaces);
            }
        }
    } finally {
        namespaces.pop();
    }
}

function computeQname(nameWithOptionalPrefix: string, namespaces: XmlNamespaces): Qname {
    const i = nameWithOptionalPrefix.indexOf(':');
    if (i < 0) return { name: nameWithOptionalPrefix, namespaceUri: namespaces.findNamespaceUri('') };
    return { name: nameWithOptionalPrefix.substring(i + 1), namespaceUri: namespaces.getNamespaceUri(nameWithOptionalPrefix.substring(0, i)) };
}

//

class XmlNamespaces {

    private stack: ReadonlyMap<string, string>[] = [];

    get stackSize(): number { return this.stack.length; }

    push(attrsMap: Record<string, string>): ReadonlyMap<string, string> {
        const attrs = computeAttributeMap(attrsMap);
        let map: Map<string, string> | undefined;
        for (const [ name, value ] of attrs.entries()) {
            if (name === 'xmlns') {
                map = map || new Map<string, string>();
                map.set('', value);
            } else if (name.startsWith('xmlns:')) {
                map = map || new Map<string, string>();
                const prefix = name.substring(6);
                map.set(prefix, value);
            }
        }
        this.stack.push(map || EMPTY_STRING_MAP);
        return attrs;
    }

    pop() {
        this.stack.pop();
    }

    findNamespaceUri(prefix: string): string | undefined {
        for (let i = this.stack.length - 1; i >= 0; i--) {
            const rt = this.stack[i].get(prefix);
            if (rt) return rt;
        }
        return undefined;
    }

    getNamespaceUri(prefix: string): string {
        for (let i = this.stack.length - 1; i >= 0; i--) {
            const rt = this.stack[i].get(prefix);
            if (rt) return rt;
        }
        throw new Error(`getNamespaceUri: prefix not found: ${prefix}`);
    }

}
