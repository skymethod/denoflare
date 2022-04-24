import { Bytes } from '../bytes.ts';
import { checkEqual } from '../check.ts';
import { ExtendedXmlNode, parseXml } from '../xml_parser.ts';
import { AwsCallContext, checkIso8601, computeHeadersString, parseBoolean, parseNonNegativeInteger, R2, readText, signAwsCallV4 } from './r2.ts';

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
    checkEqual('xml.tagName', xml.tagname, '!xml');
    // TODO recursively check for no atts
    for (const [ name, value ] of Object.entries(xml.child)) {
        if (name === 'ListBucketResult') {
            checkEqual('ListBucketResult.length', value.length, 1);
            return parseListBucketResult(value[0] as ExtendedXmlNode);
        } else {
            throw new Error(`parseListBucketResultXml: unknown child ${name}`);
        }
    }
    throw new Error();
}

function parseListBucketResult(xml: ExtendedXmlNode): ListBucketResult {
    checkEqual('ListBucketResult.attrs.size', xml.atts.size, 0);
    let name_: string | undefined;
    let isTruncated: boolean | undefined;
    let maxKeys: number | undefined;
    let keyCount: number | undefined;
    const contents: ListBucketResultItem[] = [];
    for (const [ name, value ] of Object.entries(xml.child)) {
        if (name === 'Name') {
            name_ = readText(value);
        } else if (name === 'Contents') {
            for (const node of value) {
                contents.push(parseListBucketResultItem(node as ExtendedXmlNode));
            }
        } else if (name === 'IsTruncated') {
            isTruncated = parseBoolean('IsTruncated', readText(value));
        } else if (name === 'MaxKeys') {
            maxKeys = parseNonNegativeInteger('MaxKeys', readText(value));
        } else if (name === 'KeyCount') {
            keyCount = parseNonNegativeInteger('KeyCount', readText(value));
        } else {
            console.log(xml);
            throw new Error(`parseListBucketResult: unknown child ${name}`);
        }
    }
    if (name_ === undefined || isTruncated === undefined || maxKeys === undefined || keyCount === undefined) throw new Error(`parseListBucketResult: incomplete: ${JSON.stringify({ name: name_, isTruncated, maxKeys, keyCount, contents })}`);
    return { name: name_, isTruncated, maxKeys, keyCount, contents };
}

function parseListBucketResultItem(xml: ExtendedXmlNode): ListBucketResultItem {
    let key: string | undefined;
    let size: number | undefined;
    let lastModified: string | undefined;
    let owner: ListBucketResultOwner | undefined;
    let etag: string | undefined;
    for (const [ name, value ] of Object.entries(xml.child)) {
        if (name === 'Key') {
            key = readText(value);
        } else if (name === 'Size') {
            size = parseNonNegativeInteger('Size', readText(value));
        } else if (name === 'LastModified') {
            lastModified = readText(value);
            checkIso8601('LastModified', lastModified);
        } else if (name === 'Owner') {
            checkEqual('Owner.length', value.length, 1);
            owner = parseListBucketResultOwner(value[0] as ExtendedXmlNode);
        } else if (name === 'ETag') {
            etag = readText(value);
        }else {
            console.log(xml);
            throw new Error(`parseListBucketResultItem: unknown child ${name}`);
        }
    }
    if (key === undefined || size === undefined || lastModified === undefined || owner === undefined || etag === undefined) throw new Error(`parseListBucketResultItem: incomplete: ${JSON.stringify({ key, size, lastModified, owner, etag })}`);
    return { key, size, lastModified, owner, etag };
}

function parseListBucketResultOwner(xml: ExtendedXmlNode): ListBucketResultOwner {
    let id: string | undefined;
    let displayName: string | undefined;
    for (const [ name, value ] of Object.entries(xml.child)) {
        if (name === 'ID') {
            id = readText(value);
        } else if (name === 'DisplayName') {
            displayName = readText(value);
        } else {
            console.log(xml);
            throw new Error(`parseListBucketResultOwner: unknown child ${name}`);
        }
    }
    if (!id || !displayName) throw new Error(`parseListBucketResultOwner: incomplete: ${({ id, displayName })}`);
    return { id, displayName };
}
