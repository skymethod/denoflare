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
        node.order = item.order;
    }
    trimHidden(root);
    sort(root);
    return root;
}

export interface SidebarInputItem {
    readonly title: string;
    readonly path: string;
    readonly hidden: boolean | undefined;
    readonly hideChildren: boolean | undefined;
    readonly order: number | undefined;
}

//

interface Node {
    title: string;
    path: string;
    hidden?: boolean;
    hideChildren?: boolean;
    children: Node[];
    order?: number;
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
        node.children = node.children.filter(v => !v.hidden && !v.path.endsWith('/404'));
        for (const child of node.children) {
            trimHidden(child);
        }
    }
}

function sort(node: Node) {
    node.children.sort((lhs, rhs) => {
        if (lhs.order !== undefined && rhs.order !== undefined) {
            return lhs.order - rhs.order;
        } else if (lhs.order === undefined && rhs.order === undefined) {
            return lhs.title.localeCompare(rhs.title);
        } else if (lhs.order !== undefined && rhs.order === undefined) {
            return 1;
        } else {
            return -1;
        }
    });
    for (const child of node.children) {
        sort(child);
    }
}
