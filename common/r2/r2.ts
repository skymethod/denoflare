import { Bytes } from '../bytes.ts';
import { checkMatches } from '../check.ts';
import { ExtendedXmlNode, parseXml } from '../xml_parser.ts';
import { KnownElement } from './known_element.ts';
export { listObjects } from './list_objects.ts';
export { listObjectsV2 } from './list_objects_v2.ts';
export type { ListBucketResultItem } from './list_objects_v2.ts';
export { getObject, headObject } from './get_head_object.ts';
export { listBuckets } from './list_buckets.ts';
export { headBucket } from './head_bucket.ts';
export { createBucket } from './create_bucket.ts';
export { deleteBucket } from './delete_bucket.ts';
export { putObject } from './put_object.ts';
export { deleteObject } from './delete_object.ts';
export { deleteObjects } from './delete_objects.ts';
export { copyObject } from './copy_object.ts';
export { createMultipartUpload } from './create_multipart_upload.ts';
export { abortMultipartUpload } from './abort_multipart_upload.ts';
export { completeMultipartUpload } from './complete_multipart_upload.ts';
export type { CompletedPart } from './complete_multipart_upload.ts';
export { uploadPart } from './upload_part.ts';
export { uploadPartCopy } from './upload_part_copy.ts';
export { getBucketEncryption } from './get_bucket_encryption.ts';
export { deleteBucketEncryption } from './delete_bucket_encryption.ts';
export { putBucketEncryption } from './put_bucket_encryption.ts';
export { getBucketLocation } from './get_bucket_location.ts';

export const R2_REGION_AUTO = 'auto';

export class R2 {
    static DEBUG = false;
}

export async function computeExpectedAwsSignature(call: AwsCall, context: Omit<AwsCallContext, 'userAgent'>) {
    const { method, url, body, region, service } = call;
    const { credentials } = context;
    const headers = new Headers(call.headers);
    const amazonDate = computeAmazonDate();
    headers.set('x-amz-date', amazonDate);

    const bodyInfo = await computeBodyInfo(body, context.unsignedPayload);
    headers.set('x-amz-content-sha256', bodyInfo.bodySha256Hex || 'UNSIGNED-PAYLOAD'); // required for all v4 requests
    const canonicalRequest = computeCanonicalRequest(method, url, headers, bodyInfo.bodySha256Hex);
    if (R2.DEBUG) console.log(`canonicalRequest=<<<${canonicalRequest.text}>>>`);
    const stringToSign = await stringToSignFinal(amazonDate, region, service, canonicalRequest.text);
    if (R2.DEBUG) console.log(`stringToSign=<<<${stringToSign}>>>`);
    return await sig(credentials.secretKey, amazonDate, region, service, stringToSign);
}

export async function signAwsCallV4(call: AwsCall, context: AwsCallContext): Promise<{ signedHeaders: Headers, bodyInfo: BodyInfo }> {
    const { method, url, body, region, service } = call;
    const { userAgent, credentials } = context;
    const headers = new Headers(call.headers);
    headers.set('User-Agent', userAgent);
    const amazonDate = computeAmazonDate();
    headers.set('x-amz-date', amazonDate);

    const bodyInfo = await computeBodyInfo(body, context.unsignedPayload);
    headers.set('x-amz-content-sha256', bodyInfo.bodySha256Hex || 'UNSIGNED-PAYLOAD'); // required for all v4 requests
    const canonicalRequest = computeCanonicalRequest(method, url, headers, bodyInfo.bodySha256Hex);
    if (R2.DEBUG) console.log(`canonicalRequest=<<<${canonicalRequest.text}>>>`);
    const stringToSign = await stringToSignFinal(amazonDate, region, service, canonicalRequest.text);
    if (R2.DEBUG) console.log(`stringToSign=<<<${stringToSign}>>>`);
    const signature = await sig(credentials.secretKey, amazonDate, region, service, stringToSign);
    const authHeader = computeAuthHeader(credentials.accessKey, credentialScope(amazonDate, region, service), canonicalRequest.signedHeaders, signature);
    headers.set('Authorization', authHeader);
    return { signedHeaders: headers, bodyInfo };
}

export type UrlStyle = 'path' | 'vhost';

export function computeBucketUrl(opts: { origin: string, bucket: string, urlStyle?: UrlStyle, key?: string, subresource?: string }) {
    const { origin, bucket, urlStyle, key, subresource } = opts;
    const url = new URL(origin);
    if (urlStyle === 'path') {
        url.pathname = `/${bucket}${key ? `/${key}` : ''}`;
    } else {
        // vhost (default)
        url.hostname = `${bucket}.${url.hostname}`;
        if (key !== undefined) url.pathname = `/${key}`;
    }
    if (subresource) url.search = `?${subresource}`;
    return url;
}

export async function s3Fetch(opts: { method: 'GET' | 'HEAD' | 'PUT' | 'DELETE' | 'POST', url: URL, headers?: Headers, body?: AwsCallBody, region: string, context: AwsCallContext }): Promise<Response> {
    const { url, region, context, method } = opts;
    const headers = opts.headers || new Headers();
    const body = opts.body || Bytes.EMPTY;
    const service = 's3';
    const { signedHeaders, bodyInfo } = await signAwsCallV4({ method, url, headers, body, region, service }, context);
    const urlStr = url.toString();
    if (R2.DEBUG) console.log(method + ' ' + urlStr);
    if (R2.DEBUG) console.log(`signedHeaders: ${computeHeadersString(signedHeaders)}`);
    const res = await fetch(urlStr, { method, headers: signedHeaders, body: bodyInfo.bodyLength === 0 ? undefined : bodyInfo.body });
    if (R2.DEBUG) console.log(`${res.status} ${computeHeadersString(res.headers)}`);
    return res;
}

export function parseBucketResultOwner(element: KnownElement): BucketResultOwner;
export function parseBucketResultOwner(element: KnownElement | undefined): BucketResultOwner | undefined;
export function parseBucketResultOwner(element: KnownElement | undefined): BucketResultOwner | undefined {
    if (element === undefined) return undefined;
    const id = element.getElementText('ID')
    const displayName = element.getElementText('DisplayName');
    element.check();
    return { id, displayName };
}

export async function throwIfUnexpectedStatus(res: Response, ...expectedStatus: number[]) {
    if (expectedStatus.includes(res.status)) return;
    let errorMessage = `Unexpected status ${res.status}`;
    const contentTypeLower = (res.headers.get('content-type') || '').toLowerCase();
    if (contentTypeLower.startsWith('text') || contentTypeLower.includes('xml')) {
        const text = await res.text();
        if (text.startsWith('<')) {
            try {
                const xml = parseXml(text);
                const result = parseErrorResultXml(xml);
                errorMessage += `, code=${result.code}, message=${result.message}`;
            } catch (e) {
                errorMessage += ` parseError=${e.stack || e} body=${text}`;
            }
        }
    }
    throw new Error(errorMessage);
}

export function throwIfUnexpectedContentType(res: Response, expectedContentType: string, bodyTxt: string) {
    const contentType = res.headers.get('content-type') || undefined;
    if (contentType !== expectedContentType) throw new Error(`Unexpected content-type ${contentType}, headers=${computeHeadersString(res.headers)} body=${bodyTxt}`);
}

export function computeHeadersString(headers: Headers): string {
    return [...headers].map(v => v.join(': ')).join(', ');
}

export function checkIso8601(name: string, value: string): RegExpExecArray {
    const rt = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{3})?Z$/.exec(value);
    if (!rt) {
        throw new Error(`Bad ${name}: ${value}`);
    }
    return rt;
}

export function computeAwsCallBodyLength(body: AwsCallBody): number {
    return typeof body === 'string' ? Bytes.ofUtf8(body).length
        : body instanceof Bytes ? body.length
        : body.length;
}

export function checkBoolean(text: string, name: string): boolean {
    checkMatches(name, text, /^(true|false)$/);
    return text === 'true';
}

export function computeAmazonDate(): string {
    const iso8601 = new Date().toISOString();
    const rt = checkIso8601('iso8601', iso8601);
    return `${rt[1]}${rt[2]}${rt[3]}T${rt[4]}${rt[5]}${rt[6]}Z`;
}

export function tryParseAmazonDate(amazonDate: string): Date | undefined {
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(amazonDate);
    return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`) : undefined;
}

//

export interface AwsCallContext {
    readonly credentials: AwsCredentials;
    readonly userAgent: string;
    readonly unsignedPayload?: boolean;
}

export interface AwsCredentials {
    readonly accessKey: string;
    readonly secretKey: string;
}

export type AwsCallBody = Bytes | string | { stream: ReadableStream, length: number, sha256Hex: string, md5Base64?: string };

export interface AwsCall {
    readonly method: 'GET' | 'HEAD' | 'POST' | 'DELETE' | 'PUT';
    readonly url: URL;
    readonly headers: Headers;
    readonly body: AwsCallBody;
    readonly region: string;
    readonly service: string;
}

export interface ErrorResult {
    readonly code: string;
    readonly message: string;
}

export interface BucketResultOwner {
    readonly id: string;
    readonly displayName: string;
}

//

function uriEncode(value: string): string {
    if (value === '') return value;
    let rt = '';
    const len = value.length;
    let i = 0;
    while (i < len) {
        const c = value.substring(i, i + 1);
        if (c === '.' || c === '_' || c === '-' || c === '~' || isLetterOrDigit(c)) {
            rt += c;
            i++;
        } else {
            const codePoint = value.codePointAt(i);
            if (codePoint === undefined) throw new Error(`No codePoint at ${i}`);
            const str = String.fromCodePoint(codePoint);
            rt += `%${codePoint.toString(16).toUpperCase()}`;
            i += str.length;
        }
    }
    return rt;
}

function isLetterOrDigit(c: string): boolean {
    const cc = c.charCodeAt(0);
    return cc >= 0x30 && cc <= 0x39  // 0 to 9
        || cc >= 0x41 && cc <= 0x5a  // A to Z
        || cc >= 0x61 && cc <= 0x7a; // a to z
}

function stringToSign(method: string, url: URL, includeHost: boolean): string {
    let rt = `${method}\n`;
    if (includeHost) {
        rt += `${url.hostname}\n`; // hostname does not include port
    }
    rt += url.pathname; // URL handles the encoding for us
    rt += '\n';

    let qs = '';
    for (const qpName of [...url.searchParams.keys()].sort()) { // may need to encode first?
        const qpValues = url.searchParams.getAll(qpName).map(v => uriEncode(v));
        for (const qpValue of qpValues.sort()) {
            if (qs.length > 0) qs += '&';
            qs += `${uriEncode(qpName)}=${qpValue}`;
        }
    }
    rt += qs;
    return rt;
}

function credentialScope(amazonDate: string, region: string, service: string): string {
    return `${amazonDate.substring(0, 8)}/${region}/${service}/aws4_request`;
}

function computeAuthHeader(accessKey: string, credentialScope: string, signedHeaders: string, signature: string): string {
    return `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

async function hmac(data: string, key: Bytes): Promise<Bytes> {
    return await Bytes.ofUtf8(data).hmacSha256(key);
}

async function sig(secretKey: string, amazonDate: string, region: string, service: string, stringToSign: string): Promise<string> {
    const kSecret = Bytes.ofUtf8(`AWS4${secretKey}`);
    const kDate = await hmac(amazonDate.substring(0, 8), kSecret);
    const kRegion = await hmac(region, kDate);
    const kService = await hmac(service, kRegion);
    const kSigning = await hmac('aws4_request', kService);
    const sig = await hmac(stringToSign, kSigning);
    return sig.hex();
}

function computeCanonicalRequest(method: string, url: URL, headers: Headers, bodySha256Hex: string): CanonicalRequest {
    let canonicalRequest = stringToSign(method, url, false);
    canonicalRequest += '\n';

    const lowerHeaders = [...headers.entries()].map(v => [v[0].toLowerCase(), v[1]]);

    if (!lowerHeaders.some(v => v[0] === 'host')) {
        lowerHeaders.push(['host', url.hostname])
    }
    let canonicalHeaders = '';
    let signedHeaders = '';
    for (const sortedHeader of lowerHeaders.sort((lhs, rhs) => { const rt = lhs[0].localeCompare(rhs[0]); return rt; })) {
        canonicalHeaders += `${sortedHeader[0]}:${sortedHeader[1]}\n`;
        signedHeaders += `${signedHeaders.length > 0 ? ';' : ''}${sortedHeader[0]}`;
    }
    canonicalRequest += `${canonicalHeaders}\n`;
    canonicalRequest += `${signedHeaders}\n`;

    canonicalRequest += bodySha256Hex;
    return {
        text: canonicalRequest,
        signedHeaders
    };
}

async function stringToSignFinal(amazonDate: string, region: string, service: string, canonicalRequest: string): Promise<string> {
    let stringToSign = 'AWS4-HMAC-SHA256\n';
    stringToSign += `${amazonDate}\n`;
    stringToSign += credentialScope(amazonDate, region, service) + '\n';
    stringToSign += (await Bytes.ofUtf8(canonicalRequest).sha256()).hex();
    return stringToSign;
}

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

async function computeBodyInfo(body: AwsCallBody, unsignedPayload: boolean | undefined): Promise<BodyInfo> {
    let bodySha256Hex = 'UNSIGNED-PAYLOAD';
    if (typeof body === 'string') {
        const bytes = Bytes.ofUtf8(body);
        if (!unsignedPayload) bodySha256Hex = (await bytes.sha256()).hex();
        const bodyLength = bytes.length;
        return { body, bodySha256Hex, bodyLength };
    } else if (body instanceof Bytes) {
        if (!unsignedPayload) bodySha256Hex =(await body.sha256()).hex();
        const bodyLength = body.length;
        return { body: body.array(), bodySha256Hex, bodyLength };
    } else {
        if (!unsignedPayload) bodySha256Hex = body.sha256Hex;
        return { body: body.stream, bodySha256Hex: bodySha256Hex, bodyLength: body.length };
    }
}

//

type CanonicalRequest = { text: string, signedHeaders: string };

type BodyInfo = { body: BodyInit; bodySha256Hex: string; bodyLength: number; };
