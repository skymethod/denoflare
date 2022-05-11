import { IncomingRequestCf, R2Object, R2ObjectBody, R2Range, R2GetOptions } from './deps.ts';
import { WorkerEnv } from './worker_env.d.ts';

export default {

    async fetch(request: IncomingRequestCf, env: WorkerEnv): Promise<Response> {
        try {
            return await computeResponse(request, env);
        } catch (e) {
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

    const { pathname } = new URL(request.url);
    let key = pathname.substring(1);
    if (method === 'GET' || method === 'HEAD') {
        if (flags.has('disallowRobots') && key === 'robots.txt') {
            return new Response(method === 'GET' ? 'User-agent: *\nDisallow: /' : undefined, { headers: { 'content-type': TEXT_PLAIN_UTF8 }});
        }
        let obj: R2Object | null = null;
        const getOrHead: (key: string, options?: R2GetOptions) => Promise<R2Object | null> = (key, options) => method === 'GET' ? bucket.get(key, options) : bucket.head(key, options);
        if (key !== '_headers') {
            const range = tryParseRange(headers);
            obj = key === '' ? null : await getOrHead(key, { range });
            if (!obj) {
                if (key === '' || key.endsWith('/')) {
                    key += 'index.html';
                    obj = await getOrHead(key, { range });
                } else {
                    key += '/index.html';
                    obj = await bucket.head(key);
                    if (obj) {
                        return new Response(undefined, { status: 308, headers: { 'location': pathname + '/' } });
                    }
                }
            }
            if (obj) {
                return computeObjResponse(obj, range ? 206 : 200);
            }
        }
        // 404
        obj = await getOrHead('404.html');
        if (obj) {
            return computeObjResponse(obj, 404);
        }
        return new Response(method === 'GET' ? 'not found' : undefined, { status: 404, headers: { 'content-type': TEXT_PLAIN_UTF8 } });
    } else {
        return new Response(`Method '${method}' not allowed`, { status: 405 });
    }
}

function isR2ObjectBody(obj: R2Object): obj is R2ObjectBody {
    return 'body' in obj;
}

function computeObjResponse(obj: R2Object, status: number): Response {
    const headers = computeHeaders(obj);
    let body = isR2ObjectBody(obj) ? obj.body : undefined;
    if (headers.get('content-encoding') === 'gzip' && headers.get('cache-control') === 'no-transform') {
        // r2 bug: cf will double gzip in this case!
        // for now, decompress it in the worker and let cf autocompress take over
        if (body) {
            const ds = new DecompressionStream('gzip');
            body = body.pipeThrough(ds);
        }
        headers.delete('content-encoding');
        headers.delete('cache-control');
    }
    return new Response(body, { status, headers });
}

function computeHeaders(obj: R2Object): Headers {
    const headers = new Headers();
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
            headers.set('cache-control', 'no-transform'); // try to disable cf transparent compression
        }
        if (contentDisposition.includes('max-age') || contentDisposition.includes('no-transform') || contentDisposition.includes('public')) {
            headers.set('cache-control', contentDisposition);
        }
    }
    if (contentEncoding) headers.set('x-r2-content-encoding', contentEncoding);
    if (cacheControl) headers.set('x-r2-cache-control', cacheControl);
    if (cacheExpiry) headers.set('x-r2-cache-expiry', cacheExpiry.toISOString());
    return headers;
}

function tryParseRange(headers: Headers): R2Range | undefined {
    const m = /^bytes=(\d+)-(\d+)$/.exec(headers.get('range') || ''); // cf bucket api only supports byte ranges with bounded start and end
    if (!m) return undefined;
    const offset = parseInt(m[1]);
    const length = parseInt(m[2]) - offset + 1;
    if (length < 1) return undefined;
    return { offset, length };
}
