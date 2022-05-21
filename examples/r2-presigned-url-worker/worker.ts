import { Bytes } from '../../common/bytes.ts';
import { AwsCall, computeExpectedAwsSignature, R2, tryParseAmazonDate } from '../../common/r2/r2.ts';
import { IncomingRequestCf, R2Object, R2ObjectBody, R2Range, R2GetOptions, R2Conditional } from './deps.ts';
import { WorkerEnv } from './worker_env.d.ts';

export default {

    async fetch(request: IncomingRequestCf, env: WorkerEnv): Promise<Response> {
        try {
            return await computeResponse(request, env);
        } catch (e) {
            if (typeof e === 'object' && e.message === 'The requested range is not satisfiable') {
                return new Response(e.message, { status: 416 });
            }
            return new Response(`${e.stack || e}`, { status: 500 });
        }
    }

};

//

declare global {

    interface ResponseInit {
        // non-standard cloudflare property, defaults to 'auto'
        encodeBody?: 'auto' | 'manual';
    }

}

interface Credential {
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
}

//

const TEXT_PLAIN_UTF8 = 'text/plain; charset=utf-8';

async function computeResponse(request: IncomingRequestCf, env: WorkerEnv): Promise<Response> {
    const { bucket } = env;
    const flags = stringSetFromCsv(env.flags);
    const allowIps = stringSetFromCsv(env.allowIps);
    const denyIps = stringSetFromCsv(env.denyIps);
    const credentials = parseCredentials(env.credentials);
    const maxSkewMinutes = tryParsePositiveInteger('maxSkewMinutes', env.maxSkewMinutes);
    const maxExpiresMinutes = tryParsePositiveInteger('maxExpiresMinutes', env.maxExpiresMinutes);

    const { method, url, headers } = request;
    console.log(JSON.stringify({ accessKeyIds: credentials.map(v => v.accessKeyId), flags: [...flags] }));

    // apply ip filters, if configured
    const ip = headers.get('cf-connecting-ip') || 'unknown';
    if (denyIps.size > 0 && denyIps.has(ip)) return notFound(method);
    if (allowIps.size > 0 && !allowIps.has(ip)) return notFound(method);

    // only support GETs for now
    if (method !== 'GET') {
        return new Response(`Method '${method}' not allowed`, { status: 405 });
    }

    // parse bucket-name, key from url
    const { hostname, pathname, searchParams } = new URL(url);
    const debug = searchParams.has('debug');
    const m = /^\/(.+?)\/(.+)$/.exec(pathname);
    if (!m) return notFound(method);
    const [ _, bucketName, keyEncoded ] = m;
    const key = decodeURIComponent(keyEncoded);
    console.log(JSON.stringify({ hostname, bucketName, keyEncoded, key }));

    // check auth
    const credential = await isPresignedUrlAuthorized({ url, searchParams, credentials, debug, maxSkewMinutes, maxExpiresMinutes });
    if (!credential) return unauthorized();

    // authorized!
    console.log(`Authorized request from ${credential.accessKeyId}`);

    // parse any conditional request options from the request headers
    let range = method === 'GET' ? tryParseRange(headers) : undefined;
    const onlyIf = method === 'GET' ? tryParseR2Conditional(headers) : undefined;

    // first, try to request the object at the given key
    let obj: R2Object | null = null;
    const loggedGet: (key: string, options: R2GetOptions) => Promise<R2Object | null> = (key, options) => {
        console.log(`${method} ${key} ${JSON.stringify(options)}`);
        return bucket.get(key, options);
    };
    obj = key === '' ? null : await loggedGet(key, { range, onlyIf });
    if (obj) {
        // choose not to satisfy range requests for encoded content
        // unfortunately we don't know it's encoded until after the first request
        if (range && computeHeaders(obj, range).has('content-encoding')) {
            console.log(`re-request without range`);
            range = undefined;
            obj = await bucket.get(key);
            if (obj === null) throw new Error(`Object ${key} existed for .get with range, but not without`);
        }
        return computeObjResponse(obj, range ? 206 : 200, range, onlyIf);
    }

    // object not found
    return notFound(method);
}

function tryParsePositiveInteger(name: string, value: string | undefined): number | undefined {
    if (value === undefined) return value;
    try {
        const integer = parseInt(value);
        if (String(integer) === value && integer > 0) return integer;
    } catch {
        // noop
    }
    console.log(`Bad ${name}: ${value}, ignoring`);
    return undefined;
}

function stringSetFromCsv(value: string | undefined) {
    return new Set((value ?? '').split(',').map(v => v.trim()).filter(v => v !== ''));
}

function notFound(method: string): Response {
    return new Response(method === 'HEAD' ? undefined : 'not found', { status: 404, headers: { 'content-type': TEXT_PLAIN_UTF8 } });
}

function unmodified(): Response {
    return new Response(undefined, { status: 304 });
}

function preconditionFailed(): Response {
    return new Response('precondition failed', { status: 412 });
}

function unauthorized(): Response {
    return new Response('unauthorized', { status: 401 });
}

function isR2ObjectBody(obj: R2Object): obj is R2ObjectBody {
    return 'body' in obj;
}

function computeObjResponse(obj: R2Object, status: number, range?: R2Range, onlyIf?: R2Conditional): Response {
    let body: ReadableStream | undefined;
    if (isR2ObjectBody(obj)) {
        body = obj.body;
    } else if (onlyIf) {
        if (onlyIf.etagDoesNotMatch) return unmodified();
        if (onlyIf.uploadedAfter) return unmodified();
        if (onlyIf.etagMatches) return preconditionFailed();
        if (onlyIf.uploadedBefore) return preconditionFailed();
    }
    
    const headers = computeHeaders(obj, range);

    // non-standard cloudflare ResponseInit property indicating the response is already encoded
    // required to prevent the cf frontend from double-encoding it, or serving it encoded without a content-encoding header
    const encodeBody = headers.has('content-encoding') ? 'manual' : undefined;

    return new Response(body, { status, headers, encodeBody });
}

function computeHeaders(obj: R2Object, range?: R2Range): Headers {
    const headers = new Headers();
    // writes content-type, content-encoding, content-disposition, i.e. the values from obj.httpMetadata
    obj.writeHttpMetadata(headers);
    console.log('writeHttpMetadata', [...headers].map(v => v.join(': ')).join(', ')); // for debugging, writeHttpMetadata was buggy in the past

    // obj.size represents the full size, but seems to be clamped by the cf frontend down to the actual number of bytes in the partial response
    // exactly what we want in a content-length header
    headers.set('content-length', String(obj.size));

    headers.set('etag', obj.httpEtag); // the version with double quotes, e.g. "96f20d7dc0d24de9c154d822967dcae1"
    headers.set('last-modified', obj.uploaded.toUTCString()); // toUTCString is the http date format (rfc 1123)

    if (range) headers.set('content-range', computeContentRange(range, obj.size));
    return headers;
}

function tryParseRange(headers: Headers): R2Range | undefined {
    const m = /^bytes=(\d*)-(\d*)$/.exec(headers.get('range') || '');
    if (!m) return undefined;
    const lhs = m[1] === '' ? undefined : parseInt(m[1]);
    const rhs = m[2] === '' ? undefined : parseInt(m[2]);
    if (lhs === undefined && typeof rhs === 'number') return { suffix: rhs };
    if (typeof lhs === 'number' && rhs === undefined) return { offset: lhs };
    if (typeof lhs === 'number' && typeof rhs === 'number') {
        const length = rhs - lhs + 1;
        return length > 0 ? { offset: lhs, length } : undefined;
    }
}

function tryParseR2Conditional(headers: Headers): R2Conditional | undefined {
    // r2 bug: onlyIf takes Headers, but processes them incorrectly (such as not allowing double quotes on etags)
    // so we need to do them by hand for now

    const ifNoneMatch = headers.get('if-none-match') || undefined;
    const etagDoesNotMatch = ifNoneMatch ? stripEtagQuoting(ifNoneMatch) : undefined;

    const ifMatch = headers.get('if-match') || undefined;
    const etagMatches = ifMatch ? stripEtagQuoting(ifMatch) : undefined;

    const ifModifiedSince = headers.get('if-modified-since') || undefined;
    // if-modified-since date format (rfc 1123) is at second resolution, uploaded is at millis resolution
    // workaround for now is to add a second to the provided value
    const uploadedAfter = ifModifiedSince ? addingOneSecond(new Date(ifModifiedSince)) : undefined; 

    const ifUnmodifiedSince = headers.get('if-unmodified-since') || undefined;
    const uploadedBefore = ifUnmodifiedSince ? new Date(ifUnmodifiedSince) : undefined;

    return etagDoesNotMatch || etagMatches || uploadedAfter || uploadedBefore ? { etagDoesNotMatch, etagMatches, uploadedAfter, uploadedBefore } : undefined;
}

function stripEtagQuoting(str: string): string {
    const m = /^(W\/)?"(.*)"$/.exec(str);
    return m ? m[2] : str;
}

function addingOneSecond(time: Date): Date {
    return new Date(time.getTime() + 1000);
}

function computeContentRange(range: R2Range, size: number) {
    const offset = 'offset' in range ? range.offset : undefined;
    const length = 'length' in range ? range.length : undefined;
    const suffix = 'suffix' in range ? range.suffix : undefined;

    const startOffset = typeof suffix === 'number' ? size - suffix
        : typeof offset === 'number' ? offset
        : 0;
    const endOffset = typeof suffix === 'number' ? size
        : typeof length === 'number' ? startOffset + length
        : size;

    return `bytes ${startOffset}-${endOffset - 1}/${size}`;
}

function parseCredentials(str: string | undefined): Credential[] {
    return str ? str.split(',').map(v => v.trim()).filter(v => v !== '').map(parseCredential) : [];
}

function parseCredential(str: string): Credential {
    const [ accessKeyId, secretAccessKey ] = str.split(':');
    return { accessKeyId, secretAccessKey };
}

async function isPresignedUrlAuthorized(opts: { url: string, searchParams: URLSearchParams, credentials: Credential[], debug?: boolean, maxSkewMinutes?: number, maxExpiresMinutes?: number }): Promise<Credential | undefined> {
    const { url, searchParams, credentials, debug, maxSkewMinutes = 15, maxExpiresMinutes = 60 * 24 * 7 /* aws max 7 days */ } = opts;

/*
https://<host>/<bucket-name>/<key>
?X-Amz-Algorithm=AWS4-HMAC-SHA256
&X-Amz-Credential=<access-key-id>%2F<yyyymmdd>%2F<region>%2F<service>%2Faws4_request
&X-Amz-Date=<yyyymmdd>T<hhmmss>Z
&X-Amz-Expires=<seconds>
&X-Amz-SignedHeaders=host
&X-Amz-Signature=<64-hex-chars>
*/

    if (debug) R2.DEBUG = true;
    try {
        // validate X-Amz-Algorithm
        const xAmzAlgorithm = searchParams.get('X-Amz-Algorithm') || undefined;
        if (!xAmzAlgorithm) throw new Error(`Missing X-Amz-Algorithm parameter`);
        if (xAmzAlgorithm !== 'AWS4-HMAC-SHA256') throw new Error(`Invalid X-Amz-Algorithm parameter: ${xAmzAlgorithm}`);

        // validate X-Amz-SignedHeaders
        const xAmzSignedHeaders = searchParams.get('X-Amz-SignedHeaders') || undefined;
        if (!xAmzSignedHeaders) throw new Error(`Missing X-Amz-SignedHeaders parameter`);
        const signedHeaders = xAmzSignedHeaders.split(';');
        if (JSON.stringify(signedHeaders) !== JSON.stringify([ 'host' ])) throw new Error(`Unsupported X-Amz-SignedHeaders parameter: ${xAmzSignedHeaders}`);

        // validate X-Amz-Date
        const xAmzDate = searchParams.get('X-Amz-Date') || undefined;
        if (!xAmzDate) throw new Error(`Missing X-Amz-Date parameter`);
        if (!/^\d{8}T\d{6}Z$/.test(xAmzDate)) throw new Error(`Invalid X-Amz-Date parameter: ${xAmzDate}`);
        const parsedDate = tryParseAmazonDate(xAmzDate);
        if (!parsedDate) throw new Error(`Invalid X-Amz-Date parameter: ${xAmzDate}`);
        const skewMillis = Date.now() - parsedDate.getTime();
        if (Math.abs(skewMillis) > maxSkewMinutes * 60 * 1000) throw new Error(`Request too skewed: ${skewMillis / 1000 / 60} minutes`);

        // validate X-Amz-Expires
        const xAmzExpires = searchParams.get('X-Amz-Expires') || undefined;
        if (!xAmzExpires) throw new Error(`Missing X-Amz-Expires parameter`);
        const expiresSeconds = (() => {
            try {
                const seconds = parseInt(xAmzExpires);
                if (String(seconds) === xAmzExpires && seconds > 0 && seconds <= 60 * maxExpiresMinutes) return seconds;
            } catch {
                // noop
            }
            throw new Error(`Invalid X-Amz-Expires parameter: ${xAmzExpires}`);
        })();
        const expiresAt = parsedDate.getTime() + expiresSeconds * 1000;
        if (Date.now() > expiresAt) throw new Error(`Request expired`);

        // ensure X-Amz-Signature exists
        const xAmzSignature = searchParams.get('X-Amz-Signature') || undefined;
        if (!xAmzSignature) throw new Error(`Missing X-Amz-Signature parameter`);

        // validate X-Amz-Credential 
        const xAmzCredential = searchParams.get('X-Amz-Credential') || undefined;
        if (!xAmzCredential) throw new Error(`Missing X-Amz-Credential parameter`);
        const m = /^(.+)\/(\d{8})\/([a-z0-9-]+)\/([a-z0-9-]+)\/aws4_request$/.exec(xAmzCredential);
        if (!m) throw new Error(`Invalid X-Amz-Credential parameter: ${xAmzCredential}`);
        const [ _, accessKeyId, yyyymmdd, region, service ] = m;
        if (yyyymmdd !== xAmzDate.substring(0, 8)) throw new Error(`Invalid X-Amz-Credential yyyymmdd: ${yyyymmdd}`);
        if (!/^[a-z0-9-]+$/.test(region)) throw new Error(`Invalid X-Amz-Credential region: ${region}`); // allow any region value for now
        if (service !== 's3') throw new Error(`Invalid X-Amz-Credential service: ${service}`);

        // lookup credential by accessKeyId
        const candidates = credentials.filter(v => v.accessKeyId === accessKeyId);
        if (candidates.length === 0) throw new Error(`Unknown X-Amz-Credential accessKeyId: ${accessKeyId}`);
        if (candidates.length > 1) throw new Error(`Multiple candidates for X-Amz-Credential accessKeyId: ${accessKeyId}`);
        const credential = credentials[0];
        
        // compute original aws call
        const u = new URL(url);
        for (const key of [...u.searchParams.keys()]) {
            if (['X-Amz-Algorithm', 'X-Amz-Credential', 'X-Amz-Date', 'X-Amz-Expires', 'X-Amz-SignedHeaders'].includes(key)) continue;
            u.searchParams.delete(key);
        }
        const call: AwsCall = { method: 'GET', url: u, headers: new Headers(), body: Bytes.EMPTY, region, service };

        // compute expected signature, and compare it to the one we received
        const expectedSignature = await computeExpectedAwsSignature(call, { amazonDate: xAmzDate, unsignedPayload: true, credentials: { accessKey: credential.accessKeyId, secretKey: credential.secretAccessKey }});
        if (expectedSignature !== xAmzSignature) throw new Error(`Invalid X-Amz-Signature: ${xAmzSignature}`);

        // authorized!
        return credential;
    } catch (e) {
        console.log(`isPresignedUrlAuthorized error: ${e.message}`);
        return undefined;
    }
}
