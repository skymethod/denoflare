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

const TEXT_PLAIN_UTF8 = 'text/plain; charset=utf-8';

async function computeResponse(request: IncomingRequestCf, env: WorkerEnv): Promise<Response> {
    const { bucket, pushId } = env;
    const flags = new Set((env.flags || '').split(',').map(v => v.trim()));
    const { method, url, headers } = request;
    console.log(`${method} ${url}`);
    if (pushId) console.log(`pushId: ${pushId}`);

    if (method !== 'GET' && method !== 'HEAD') {
        return new Response(`Method '${method}' not allowed`, { status: 405 });
    }

    const { pathname } = new URL(request.url);
    let key = pathname.substring(1); // strip leading slash

    // special handling for robots.txt
    if (flags.has('disallowRobots') && key === 'robots.txt') {
        return new Response(method === 'GET' ? 'User-agent: *\nDisallow: /' : undefined, { headers: { 'content-type': TEXT_PLAIN_UTF8 }});
    }

    let obj: R2Object | null = null;
    const getOrHead: (key: string, options?: R2GetOptions) => Promise<R2Object | null> = (key, options) => {
        console.log(`${method} ${key} ${JSON.stringify(options)}`);
        return method === 'GET' ? bucket.get(key, options) : bucket.head(key, options);
    };
    if (key !== '_headers') { // special handling for _headers, we'll process this later
        // first, try to request the object at the given key
        let range = method === 'GET' ? tryParseRange(headers) : undefined;
        const onlyIf = method === 'GET' ? tryParseR2Conditional(headers) : undefined;
        obj = key === '' ? null : await getOrHead(key, { range, onlyIf });
        if (!obj) {
            if (key === '' || key.endsWith('/')) { // object not found, append index.html and try again (like pages)
                key += 'index.html';
                obj = await getOrHead(key, { range, onlyIf });
            } else { // object not found, redirect non-trailing slash to trailing slash (like pages) if index.html exists
                key += '/index.html';
                obj = await bucket.head(key);
                if (obj) {
                    return new Response(undefined, { status: 308, headers: { 'location': pathname + '/' } });
                }
            }
        }
        if (obj) {
            // choose not to satisfy range requests for encoded content
            if (range && computeHeaders(obj, range).has('content-encoding')) {
                console.log('re-request without range');
                // re-request without range
                range = undefined;
                obj = await bucket.get(key);
                if (obj === null) throw new Error(`Object ${key} existed for .get with range, but not without`);
            }
            return computeObjResponse(obj, range ? 206 : 200, range, onlyIf);
        }
    }

    // R2 object not found, respond with 404
    obj = await getOrHead('404.html'); // like pages
    if (obj) {
        return computeObjResponse(obj, 404);
    }
    return new Response(method === 'GET' ? 'not found' : undefined, { status: 404, headers: { 'content-type': TEXT_PLAIN_UTF8 } });

}

function unmodified() {
    return new Response(undefined, { status: 304 });
}

function preconditionFailed(): Response {
    return new Response('precondition failed', { status: 412 });
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
    const encodeBody = headers.has('content-encoding') ? 'manual' : undefined;

    return new Response(body, { status, headers, encodeBody });
}

function computeHeaders(obj: R2Object, range?: R2Range): Headers {
    const headers = new Headers();
    // obj.size represents the full size, but seems to be clamped by the cf frontend down to the actual number of bytes in the partial response
    // exactly what we want
    headers.set('content-length', String(obj.size));
    headers.set('etag', obj.httpEtag);
    headers.set('last-modified', obj.uploaded.toUTCString()); // toUTCString is the http date format (rfc 1123)

    if (range) headers.set('content-range', `bytes ${range.offset}-${Math.min(range.offset + range.length - 1, obj.size)}/${obj.size}`);

    // obj.writeHttpMetadata(headers); // r2 bug: currently returns content-encoding and cache-control in content-disposition!
    // for now, don't trust any header except content-type
    // and try to move content-dispositions that look like known content-encoding or cache-control values
    const { contentType, contentLanguage, contentDisposition, contentEncoding, cacheControl, cacheExpiry } = obj.httpMetadata;
    if (contentType) headers.set('content-type', contentType);
    if (contentLanguage) headers.set('x-r2-content-language', contentLanguage);
    if (contentDisposition) {
        headers.set('x-r2-content-disposition', contentDisposition);
        // max-age=31536000, no-transform, public
        if (contentDisposition === 'gzip') {
            headers.set('content-encoding', contentDisposition);
        }
        if (contentDisposition.includes('max-age') || contentDisposition.includes('no-transform') || contentDisposition.includes('public') || contentDisposition.includes('immutable')) {
            headers.set('cache-control', contentDisposition);
        }
    }
    if (contentEncoding) headers.set('x-r2-content-encoding', contentEncoding);
    if (cacheControl) headers.set('x-r2-cache-control', cacheControl);
    if (cacheExpiry) headers.set('x-r2-cache-expiry', cacheExpiry.toISOString());
    return headers;
}

function tryParseRange(headers: Headers): R2Range | undefined {
    // cf bucket api only supports byte ranges with bounded start and end
    const m = /^bytes=(\d+)-(\d+)$/.exec(headers.get('range') || '');
    if (!m) return undefined;
    const offset = parseInt(m[1]);
    const length = parseInt(m[2]) - offset + 1;
    if (length < 1) return undefined;
    return { offset, length };
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

//

declare global {

    interface ResponseInit {
        // non-standard cloudflare property, defaults to 'auto'
        encodeBody?: 'auto' | 'manual';
    }

}
