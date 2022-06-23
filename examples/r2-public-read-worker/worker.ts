import { IncomingRequestCf, R2Object, R2ObjectBody, R2Range, R2GetOptions, R2Conditional, R2ListOptions } from './deps.ts';
import { computeDirectoryListingHtml } from './listing.ts';
import { WorkerEnv } from './worker_env.d.ts';

export default {

    async fetch(request: IncomingRequestCf, env: WorkerEnv): Promise<Response> {
        try {
            return await computeResponse(request, env);
        } catch (e) {
            if (typeof e === 'object' && tryParseMessageCode(e.message) === 10039) { // The requested range is not satisfiable (10039)
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

//

const TEXT_PLAIN_UTF8 = 'text/plain; charset=utf-8';
const TEXT_HTML_UTF8 = 'text/html; charset=utf-8';

const INTERNAL_KEYS = new Set();
const INTERNAL_KEYS_PAGES = new Set([ '_headers' ]); // special handling for _headers, we'll process this later

function tryParseMessageCode(message: unknown): number | undefined {
    // The requested range is not satisfiable (10039)
    const m = /^.*?\((\d+)\)$/.exec(typeof message === 'string' ? message : '');
    return m ? parseInt(m[1]) : undefined;
}

async function computeResponse(request: IncomingRequestCf, env: WorkerEnv): Promise<Response> {
    const { bucket, directoryListingLimit } = env;
    const flags = stringSetFromCsv(env.flags);
    const allowIps = stringSetFromCsv(env.allowIps);
    const denyIps = stringSetFromCsv(env.denyIps);
    const disallowRobots = flags.has('disallowRobots');
    const emulatePages = flags.has('emulatePages');
    const listDirectories = flags.has('listDirectories');

    const { method, url, headers } = request;
    console.log(JSON.stringify({ directoryListingLimit, flags: [...flags] }));
    console.log('request headers:\n' + [...headers].map(v => v.join(': ')).join('\n'));

    // apply ip filters, if configured
    const ip = headers.get('cf-connecting-ip') || 'unknown';
    if (denyIps.size > 0 && denyIps.has(ip)) return notFound(method);
    if (allowIps.size > 0 && !allowIps.has(ip)) return notFound(method);

    if (method !== 'GET' && method !== 'HEAD') {
        return new Response(`Method '${method}' not allowed`, { status: 405 });
    }

    const { pathname, searchParams } = new URL(url);
    let key = pathname.substring(1); // strip leading slash
    key = decodeURIComponent(key);

    // special handling for robots.txt, if configured
    if (disallowRobots && key === 'robots.txt') {
        return new Response(method === 'GET' ? 'User-agent: *\nDisallow: /' : undefined, { headers: { 'content-type': TEXT_PLAIN_UTF8 }});
    }

    let obj: R2Object | null = null;
    const getOrHead: (key: string, options?: R2GetOptions) => Promise<R2Object | null> = (key, options) => {
        console.log(`bucket.${method.toLowerCase()} ${key} ${JSON.stringify(options)}`);
        return method === 'GET' ? (options ? bucket.get(key, options) : bucket.get(key)) : bucket.head(key);
    };

    // hide keys considered "internal", like _headers if in pages mode
    const internalKeys = emulatePages ? INTERNAL_KEYS_PAGES : INTERNAL_KEYS;
    if (!internalKeys.has(key)) {
        // parse any conditional request options from the request headers
        let range = method === 'GET' ? tryParseRange(headers) : undefined;
        const onlyIf = method === 'GET' ? tryParseR2Conditional(headers) : undefined;

        // first, try to request the object at the given key
        obj = key === '' ? null : await getOrHead(key, { range, onlyIf });
        if (!obj && emulatePages) {
            if (key === '' || key.endsWith('/')) { // object not found, append index.html and try again (like pages)
                key += 'index.html';
                obj = await getOrHead(key, { range, onlyIf });
            } else { // object not found, redirect non-trailing slash to trailing slash (like pages) if index.html exists
                key += '/index.html';
                obj = await bucket.head(key);
                if (obj) {
                    return permanentRedirect({ location: pathname + '/' });
                }
            }
        }
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
    }

    // R2 object not found, try listing a directory, if configured
    if (listDirectories) {
        let prefix = pathname.substring(1);
        let redirect = false;
        if (prefix !== '' && !prefix.endsWith('/')) {
            prefix += '/';
            redirect = true;
        }
        const directoryListingLimitParam = searchParams.get('directoryListingLimit') || undefined;
        const limit = (() => {
            for (const [ name, value ] of Object.entries({ directoryListingLimitParam, directoryListingLimitEnv: directoryListingLimit })) {
                if (typeof value === 'string') {
                    try {
                        const limit = parseInt(value);
                        if (limit >= 1 && limit <= 1000) return limit;
                    } catch {
                        // noop
                    }
                    console.log(`Bad ${name}: ${value}, expected integer between 1 to 1000`)
                }
            }
            return 20;  // sane default
        })();
        const options: R2ListOptions = { delimiter: '/', limit, prefix: prefix === '' ? undefined : prefix, cursor: searchParams.get('cursor') || undefined }; 
        console.log(`list: ${JSON.stringify(options)}`);
        const objects = await bucket.list(options);
        if (objects.delimitedPrefixes.length > 0 || objects.objects.length > 0) {
            const { cursor } = objects;
            console.log({ numPrefixes: objects.delimitedPrefixes.length, numObjects: objects.objects.length, truncated: objects.truncated, cursor });
            return redirect ? temporaryRedirect({ location: '/' + prefix }) : new Response(computeDirectoryListingHtml(objects, { prefix, cursor, directoryListingLimitParam }), { headers: { 'content-type': TEXT_HTML_UTF8 } });
        }
    }

    // R2 response still not found, respond with 404
    if (emulatePages) {
        obj = await getOrHead('404.html');
        if (obj) {
            return computeObjResponse(obj, 404);
        }
    }

    return notFound(method);
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

function permanentRedirect(opts: { location: string }): Response {
    const { location } = opts;
    return new Response(undefined, { status: 308, headers: { 'location': location } });
}

function temporaryRedirect(opts: { location: string }): Response {
    const { location } = opts;
    return new Response(undefined, { status: 307, headers: { 'location': location } });
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
