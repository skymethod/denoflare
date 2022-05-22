import { parsePath } from '../deps_cli.ts';

export interface Page {
    readonly frontmatter: Frontmatter;
    readonly titleFromFirstH1?: string;
    readonly titleFromFilename?: string;
    readonly titleResolved: string;
    readonly markdown: string; // excluding front matter
}

export interface Frontmatter {
    readonly title?: string;
    readonly order?: number;
    readonly summary?: string;
    readonly type?: PageType;
    readonly hidden?: boolean; // from sidebar
    readonly hideChildren?: boolean; // from sidebar
}

export type PageType = 'document' | string;

export async function readPageFromFile(file: string): Promise<Page> {
    let markdown = await Deno.readTextFile(file);
    const m = /^---\n(.*?)\n---\n/s.exec(markdown);
    let title: string | undefined;
    let type: PageType = 'document';
    let summary = '';
    let order: number | undefined;
    let hidden: boolean | undefined;
    let hideChildren: boolean | undefined;
    if (m) {
        for (const line of m[1].split('\n')) {
            const { name, value } = parseFrontmatterLine(line);
            if (name === 'title') {
                if (value === '') throw new Error(`Bad title: ${value}`);
                title = value;
            } else if (name === 'type') {
                if (!/^[a-z]+$/.test(value)) throw new Error(`Bad type: ${value}`);
                type = value;
            } else if (name === 'summary') {
                if (value === '') throw new Error(`Bad summary: ${value}`);
                summary = value;
            } else if (name === 'order') {
                if (!/^\d+$/.test(value)) throw new Error(`Bad order: ${value}`);
                order = parseInt(value);
            } else if (name === 'hidden') {
                const normValue = value.toLowerCase().trim();
                if (!/^(true|false)$/.test(normValue)) throw new Error(`Bad hidden: ${value}`);
                hidden = normValue === 'true';
            } else if (name === 'hideChildren') {
                const normValue = value.toLowerCase().trim();
                if (!/^(true|false)$/.test(normValue)) throw new Error(`Bad hideChildren: ${value}`);
                hideChildren = normValue === 'true';
            }
        }
        markdown = markdown.substring(m[0].length);
    }
    let titleFromFirstH1: string | undefined;
    let titleFromFilename: string | undefined;
    if (title === undefined) {
        const filename = parsePath(file).name;
        titleFromFirstH1 = parseTitleFromFirstH1(markdown);
        if (titleFromFirstH1 === undefined) {
            titleFromFilename = filename;
        }
    }
    const titleResolved = title || titleFromFirstH1 || titleFromFilename || 'untitled';
    return { markdown, titleFromFirstH1, titleFromFilename, titleResolved, frontmatter: { title, type, summary, order, hidden, hideChildren } };
}

//

function parseFrontmatterLine(line: string): { name: string, value: string} {
    const m = /^\s*([a-z]+[a-zA-Z]+)\s*:\s*(.*?)\s*$/.exec(line);
    if (!m) throw new Error(`Bad frontmatter line: ${line}`);
    return { name: m[1], value: m[2] };
}

function parseTitleFromFirstH1(markdown: string): string | undefined {
    const input = '\n' + markdown;
    const m = /[\r\n]+#\s+(.*?)\s*[\r\n]+/s.exec(input);
    return m ? m[1] : undefined;
}
