import { ExtendedXmlNode, parseXml } from '../xml_parser.ts';
import { KnownElement } from './known_element.ts';
import { AwsCallContext, s3Fetch } from './r2.ts';

export async function getObject(opts: { bucket: string, key: string, origin: string, region: string, ifMatch?: string, ifNoneMatch?: string, ifModifiedSince?: string, ifUnmodifiedSince?: string, partNumber?: number, range?: string }, context: AwsCallContext): Promise<Response> {
    const { bucket, key, origin, region, ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince, partNumber, range } = opts;

    const url = new URL(`${origin}/${bucket}/${key}`);
    const headers = new Headers();
    if (typeof ifMatch === 'string') headers.set('if-match', ifMatch);
    if (typeof ifNoneMatch === 'string') headers.set('if-none-match', ifNoneMatch);
    if (typeof ifModifiedSince === 'string') headers.set('if-modified-since', ifModifiedSince);
    if (typeof ifUnmodifiedSince === 'string') headers.set('if-unmodified-since', ifUnmodifiedSince);
    if (typeof range === 'string') headers.set('range', range);
    if (typeof partNumber === 'number') url.searchParams.set('partNumber', String(partNumber));

    const res = await s3Fetch({ url, headers, region, context });
    if (res.status === 200 || res.status === 304) return res;
    if (res.status !== 200) {
        let errorMessage = `Unexpected status ${res.status}`;
        const contentTypeLower = (res.headers.get('content-type') || '').toLowerCase();
        if (contentTypeLower.startsWith('text')) {
            const text = await res.text();
            if (text.startsWith('<')) {
                const xml = parseXml(text);
                const result = parseErrorResultXml(xml);
                errorMessage += `, code=${result.code}, message=${result.message}`;
            }
        }
        throw new Error(errorMessage);
    }
    return res;
}

//

function parseErrorResultXml(xml: ExtendedXmlNode): ErrorResult {
    const doc = new KnownElement(xml).checkTagName('!xml');
    const rt = parseErrorResult(doc.getKnownElement('Error'));
    doc.check();
    return rt;
}

function parseErrorResult(element: KnownElement): ErrorResult {
    const code = element.getElementText('Code');
    const message = element.getElementText('Message');
    element.check();
    return { code, message };
}

//

interface ErrorResult {
    readonly code: string;
    readonly message: string;
}
