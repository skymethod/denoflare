export function encodeHtml(value: string): string {
    return value.replace(/&/g, '&amp;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export interface HtmlContribution {
    readonly title: string;
    readonly headContribution?: string;
    readonly body: string;
}
