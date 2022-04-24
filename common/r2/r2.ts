import { Bytes } from '../bytes.ts';
import { checkEqual, checkMatches } from '../check.ts';
import { XmlNode } from '../xml_parser.ts';
export { listObjectsV2 } from './list_objects_v2.ts';

export class R2 {
    static DEBUG = false;
}

export function readText(value: XmlNode[]): string {
    checkEqual('textNodes.length', value.length, 1);
    const val = value[0].val;
    if (!val) throw new Error(`readText: No text found`);
    return val;
}

export function parseNonNegativeInteger(name: string, value: string): number {
    const rt = parseInt(value);
    if (String(rt) !== value || rt < 0) throw new Error(`Bad ${name}: ${value}, expected non-negative integer`);
    return rt;
}

export function parseBoolean(name: string, value: string): boolean {
    const rt = checkMatches(name, value, /^(true|false)$/)
    return rt === 'true';
}

export async function signAwsCallV4(call: AwsCall, context: AwsCallContext): Promise<Headers> {
    const headers = new Headers(call.headers);
    headers.set('User-Agent', context.userAgent);
    const amazonDate = computeAmazonDate();
    headers.set('x-amz-date', amazonDate);
    const theCanonicalRequest = await canonicalRequest(call.method, call.url, headers, call.body);
    if (R2.DEBUG) console.log(`theCanonicalRequest=<<<${theCanonicalRequest.text}>>>`);
    const stringToSign = await stringToSignFinal(amazonDate, call.region, call.service, theCanonicalRequest.text);
    if (R2.DEBUG) console.log(`stringToSign=<<<${stringToSign}>>>`);
    const signature = await sig(context.credentials.secretKey, amazonDate, call.region, call.service, stringToSign);
    const theAuthHeader = authHeader(context.credentials.accessKey,
        credentialScope(amazonDate, call.region, call.service),
        theCanonicalRequest.signedHeaders,
        signature);
    headers.set('Authorization', theAuthHeader);
    return headers;
}

//

export interface AwsCallContext {
    readonly credentials: AwsCredentials;
    readonly userAgent: string;
}

export interface AwsCredentials {
    readonly accessKey: string;
    readonly secretKey: string;
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

//

function computeAmazonDate(): string {
    const iso8601 = new Date().toISOString();
    const rt = checkIso8601('iso8601', iso8601);
    return `${rt[1]}${rt[2]}${rt[3]}T${rt[4]}${rt[5]}${rt[6]}Z`;
}

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
    rt += url.pathname.split('/').map((token, i) => {
        return `${i > 0 ? '/' : ''}${uriEncode(token)}`;
    }).join('');
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

function authHeader(accessKey: string, credentialScope: string, signedHeaders: string, signature: string): string {
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

async function canonicalRequest(method: string, url: URL, headers: Headers, body: Bytes): Promise<CanonicalRequest> {
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

    const bodySha256 = (await body.sha256()).hex();
    canonicalRequest += bodySha256;
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

//

interface CanonicalRequest {
    readonly text: string;
    readonly signedHeaders: string;
}

interface AwsCall {
    readonly method: 'GET' | 'HEAD' | 'POST' | 'DELETE' | 'PUT';
    readonly url: URL;
    readonly headers: Headers;
    readonly body: Bytes;
    readonly region: string;
    readonly service: string;
}
