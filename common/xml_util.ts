export function encodeXml(unencoded: string): string {
    return unencoded.replaceAll(/[&<>'"]/g, (char) => {
        return UNENCODED_CHARS_TO_ENTITIES[char];
    });
}

export function decodeXml(encoded: string, additionalEntities: { [char: string]: string } = {}): string {
    return encoded.replaceAll(/&(#(\d+)|[a-z]+);/g, (str, entity, decimal) => {
        if (typeof decimal === 'string') return String.fromCharCode(parseInt(decimal));
        if (typeof entity === 'string') {
            const additional = additionalEntities[entity];
            if (additional) return additional;
            const rt = ENTITIES_TO_UNENCODED_CHARS[entity];
            if (rt) return rt;
        }
        throw new Error(`Unsupported entity: ${str}`);
    });
}

//

const UNENCODED_CHARS_TO_ENTITIES: { [char: string]: string } = {
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '\'': '&#39;', // '&#39;' is shorter than '&apos;'
    '"': '&#34;', // '&#34;' is shorter than '&quot;'
};

const ENTITIES_TO_UNENCODED_CHARS: { [char: string]: string } = {
    'lt': '<',
    'gt': '>',
    'amp': '&',
    'apos': `'`,
    'quot': '"',
};
