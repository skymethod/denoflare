export interface TocNode {
    readonly title: string;
    readonly anchorId: string;
    readonly children?: readonly TocNode[];
}

export function computeToc(): TocNode[] {
    // TODO
    return [];
    // return [
    //     { title: 'First', anchorId: 'first' },
    //     { title: 'Second', anchorId: 'second' },
    //     { 
    //         title: 'Third', 
    //         anchorId: 'third',
    //         children: [
    //             { title: 'See also', anchorId: 'see-also-1' },
    //         ]
    //      },
    // ];
}
