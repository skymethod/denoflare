import { Bytes } from '../bytes.ts';
import { checkMatches } from '../check.ts';
import { ExtendedXmlNode, parseXml } from '../xml_parser.ts';
import { AwsCallContext, computeHeadersString, R2, signAwsCallV4 } from './r2.ts';
import { KnownElement } from './known_element.ts';

export async function listObjectsV2(opts: { bucket: string, origin: string, region: string, maxKeys?: number, continuationToken?: string, delimiter?: string, prefix?: string, startAfter?: string }, context: AwsCallContext): Promise<ListBucketResult> {
    const { bucket, origin, region, maxKeys, continuationToken, delimiter, prefix, startAfter } = opts;
    const method = 'GET';
    const url = new URL(`${origin}/${bucket}/?list-type=2`);
    if (typeof maxKeys === 'number') url.searchParams.set('max-keys', String(maxKeys));
    if (typeof continuationToken === 'string') url.searchParams.set('continuation-token', continuationToken);
    if (typeof delimiter === 'string') url.searchParams.set('delimiter', delimiter);
    if (typeof prefix === 'string') url.searchParams.set('prefix', prefix);
    if (typeof startAfter === 'string') url.searchParams.set('start-after', startAfter);

    const headers = new Headers();
    const body = Bytes.EMPTY;
    headers.set('x-amz-content-sha256', (await body.sha256()).hex()); // required for all v4 requests
    const service = 's3';
    const signedHeaders = await signAwsCallV4({ method, url, headers, body, region, service }, context);
    const urlStr = url.toString();
    if (R2.DEBUG) console.log(method + ' ' + urlStr);
    if (R2.DEBUG) console.log(`signedHeaders: ${computeHeadersString(signedHeaders)}`);
    const res = await fetch(urlStr, { method, headers: signedHeaders, body: body.length === 0 ? undefined : body.array() });
    if (R2.DEBUG) console.log(`${res.status} ${computeHeadersString(res.headers)}`);
    const contentType = res.headers.get('content-type') || undefined;
    const txt = await res.text();
    if (R2.DEBUG) console.log(txt);
    const expectedStatus = res.status === 200;
    if (!expectedStatus || contentType !== 'application/xml') {
        const { status, headers, url } = res;
        const value = !expectedStatus ? `status ${status}` : `content type ${contentType}`;
        throw new Error(`Unexpected ${value} for ${url}, headers=${computeHeadersString(headers)} body=${txt}`);
    }
    const xml = parseXml(txt);
    return parseListBucketResultXml(xml);
}

//

export interface ListBucketResult {
    readonly isTruncated: boolean;
    readonly name: string;
    readonly prefix?: string;
    readonly maxKeys: number;
    readonly contents: ListBucketResultItem[];
    readonly commonPrefixes?: readonly string[];
    readonly keyCount: number;
    readonly continuationToken?: string;
    readonly nextContinuationToken?: string;
    readonly delimiter?: string;
    readonly startAfter?: string;
}

export interface ListBucketResultItem {
    readonly key: string;
    readonly size: number;
    readonly lastModified: string;
    readonly owner: ListBucketResultOwner;
    readonly etag: string;
}

export interface ListBucketResultOwner {
    readonly id: string;
    readonly displayName: string;
}

//

function parseListBucketResultXml(xml: ExtendedXmlNode): ListBucketResult {
    const doc = new KnownElement(xml).checkTagName('!xml');
    const rt = parseListBucketResult(doc.getKnownElement('ListBucketResult'));
    doc.check();
    return rt;
}

function parseListBucketResult(element: KnownElement): ListBucketResult {
    const name = element.getElementText('Name');
    const contents = element.getKnownElements('Contents').map(parseListBucketResultItem);
    const isTruncated = element.getCheckedElementText('IsTruncated', checkBoolean);
    const maxKeys = element.getCheckedElementText('MaxKeys', checkInteger);
    const keyCount = element.getCheckedElementText('KeyCount', checkInteger);
    const nextContinuationToken = element.getOptionalElementText('NextContinuationToken');
    const delimiter = element.getOptionalElementText('Delimiter');
    const startAfter = element.getOptionalElementText('StartAfter');
    const prefix = element.getOptionalElementText('Prefix');
    const commonPrefixes = parseCommonPrefixes(element.getOptionalKnownElement('CommonPrefixes'));
    element.check();
    return { name: name, isTruncated, maxKeys, keyCount, contents, nextContinuationToken, delimiter, commonPrefixes, startAfter, prefix };
}

function checkInteger(text: string, name: string): number {
    const rt = parseInt(text);
    if (String(rt) !== text) throw new Error(`${name}: Expected integer text`);
    return rt;
}

function checkBoolean(text: string, name: string): boolean {
    checkMatches(name, text, /^(true|false)$/);
    return text === 'true';
}

function parseListBucketResultItem(element: KnownElement): ListBucketResultItem {
    const key = element.getElementText('Key');
    const size = element.getCheckedElementText('Size', checkInteger);
    const lastModified = element.getElementText('LastModified');
    const owner = parseListBucketResultOwner(element.getKnownElement('Owner'));
    const etag = element.getElementText('ETag');
    element.check();
    return { key, size, lastModified, owner, etag };
}

function parseListBucketResultOwner(element: KnownElement): ListBucketResultOwner {
    const id = element.getElementText('ID')
    const displayName = element.getElementText('DisplayName');
    element.check();
    return { id, displayName };
}

function parseCommonPrefixes(element: KnownElement | undefined): string[] | undefined {
    if (element === undefined) return undefined;
    const rt = element.getElementTexts('Prefix');
    element.check();
    return rt;
}
