export interface SidebarNode {
    readonly title: string;
    readonly path: string;
    readonly children: readonly SidebarNode[];
}

export function computeSidebar(items: SidebarInputItem[]): SidebarNode {
    const root: Node = { title: 'Overview', path: '/', children: [] };

    for (const item of items) {
        const node = ensureNode(item.path, root);
        node.title = item.title;
        node.hideChildren = item.hideChildren;
        node.hidden = item.hidden;
    }
    trimHidden(root);
    return root;
}

export interface SidebarInputItem {
    readonly title: string;
    readonly path: string;
    readonly hidden?: boolean;
    readonly hideChildren?: boolean;
}

//

interface Node {
    title: string;
    path: string;
    hidden?: boolean;
    hideChildren?: boolean;
    children: Node[];
}

function ensureNode(path: string, root: Node): Node {
    if (path === '/') return root;
    if (!path.startsWith('/')) throw new Error(`Bad path: ${path}`);
    const tokens = path.substring(1).split('/');
    const name = tokens.pop();
    const parentPath = '/' + tokens.join('/');
    const parent = ensureNode(parentPath, root);
    const existing = parent.children.find(v => v.path === path);
    if (existing) return existing;
    const node: Node = { title: name!, path, children: [] };
    parent.children.push(node);
    return node;
}

function trimHidden(node: Node) {
    if (node.hideChildren) {
        node.children.splice(0);
    } else {
        node.children = node.children.filter(v => !v.hidden);
        for (const child of node.children) {
            trimHidden(child);
        }
    }
}
