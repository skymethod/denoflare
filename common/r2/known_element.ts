import { checkEqual } from '../check.ts';
import { ExtendedXmlNode, XmlNode } from '../xml_parser.ts';

export class KnownElement {
    private readonly node: ExtendedXmlNode;
    private readonly unprocessedChildNames: Set<string>;
    private readonly unprocessedAttNames: Set<string>;
    private unprocessedVal: boolean;

    constructor(node: XmlNode) {
        this.node = node as ExtendedXmlNode;
        this.unprocessedChildNames = new Set(Object.keys(node.child));
        this.unprocessedAttNames = new Set(this.node.atts.keys());
        this.unprocessedVal = typeof this.node.val === 'string';
    }

    checkTagName(tagName: string): KnownElement {
        checkEqual('tagName', this.node.tagname, tagName);
        return this;
    }

    getOptionalKnownElement(childName: string): KnownElement | undefined {
        const node = this.getOptionalElement(childName);
        return node ? new KnownElement(node) : undefined;
    }

    getKnownElement(childName: string): KnownElement {
        return new KnownElement(this.getSingleElement(childName));
    }

    getKnownElements(childName: string): KnownElement[] {
        const value = this.node.child[childName];
        if (!value) return [];
        this.unprocessedChildNames.delete(childName);
        return value.map(v => new KnownElement(v));
    }

    getElementText(childName: string): string {
        const node = this.getSingleElement(childName);
        return this.checkElementText(childName, node);
    }

    getElementTexts(childName: string): string[] {
        const value = this.node.child[childName];
        if (!value) return [];
        this.unprocessedChildNames.delete(childName);
        return value.map(v => this.checkElementText(childName, v as ExtendedXmlNode));
    }

    getOptionalElementText(childName: string): string | undefined {
        const node = this.getOptionalElement(childName);
        return node ? this.checkElementText(childName, node) : undefined;
    }

    getCheckedElementText<T>(childName: string, checkFn: (text: string, name: string) => T): T {
        return checkFn(this.getElementText(childName), childName);
    }

    getOptionalCheckedElementText<T>(childName: string, checkFn: (text: string, name: string) => T): T | undefined {
        const text = this.getOptionalElementText(childName);
        return text === undefined ? undefined : checkFn(text, childName);
    }

    check() {
        if (this.unprocessedChildNames.size > 0) {
            throw new Error(`${this.node.tagname}: Unprocessed children: ${[...this.unprocessedChildNames].sort()}`);
        }
        if (this.unprocessedAttNames.size > 0) {
            throw new Error(`${this.node.tagname}: Unprocessed atts: ${[...this.unprocessedAttNames].sort()}`);
        }
        if (this.unprocessedVal && (this.node.val || '').length > 0) {
            throw new Error(`${this.node.tagname}: Unprocessed value: ${this.node.val}`);
        }
    }

    //
    
    private getOptionalElement(childName: string): ExtendedXmlNode | undefined {
        const value = this.node.child[childName];
        if (!value || value.length == 0) return undefined;
        this.unprocessedChildNames.delete(childName);
        if (value.length === 1) return value[0] as ExtendedXmlNode;
        throw new Error(`${this.node.tagname}: Expected optional single child element ${childName}, found ${value.length}`);
    }

    private getSingleElement(childName: string): ExtendedXmlNode {
        const value = this.node.child[childName];
        if (!value || value.length == 0) throw new Error(`${this.node.tagname}: Expected child element ${childName}`);
        this.unprocessedChildNames.delete(childName);
        if (value.length === 1) return value[0] as ExtendedXmlNode;
        throw new Error(`${this.node.tagname}: Expected single child element ${childName}, found ${value.length}`);
    }

    private checkElementText(childName: string, node: ExtendedXmlNode) {
        if (Object.keys(node.child).length > 0) {
            throw new Error(`${childName}: Unprocessed children: ${[...Object.keys(node.child)].sort()}`);
        }
        if (node.atts.size > 0) {
            throw new Error(`${childName}: Unprocessed atts: ${[...node.atts.keys()].sort()}`);
        }
        if (node.val === undefined) throw new Error(`${childName}: Expected element text`);
        return node.val;
    }

}
