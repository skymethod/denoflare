export interface TocNode {
    readonly title: string;
    readonly anchorId: string;
    readonly children?: readonly TocNode[];
}

export interface Heading {
    readonly level: 2 | 3 | 4 | 5 | 6 | 7;
    readonly id: string;
    readonly text: string;
}

export function computeToc(headings: Heading[]): TocNode[] {
    return headings.map(v => ({ title: v.text, anchorId: v.id }));
}
