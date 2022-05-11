import { IncomingRequestCf, R2Bucket, R2Object } from './deps.ts';
import { WorkerEnv } from './worker_env.d.ts';

export default {

    async fetch(request: IncomingRequestCf, env: WorkerEnv): Promise<Response> {
        const { bucket, pushId } = env;
        const { method, url } = request;
        console.log(`${method} ${url} pushId=${pushId}`);
    
        const { pathname } = new URL(request.url);

        let key = pathname.substring(1);
        if (key === '') key = 'index.html';

        if (method === 'GET') {
            if (key === 'robots.txt') {
                return new Response('User-agent: *\nDisallow: /');
            }
            const obj = await bucket.get(key);
            if (obj) {
                const headers = computeHeaders(obj);
                let body = obj.body;
                if (headers.get('content-encoding') === 'gzip' && headers.get('cache-control') === 'no-transform') {
                    // r2 bug: cf will double gzip in this case!
                    // for now, decompress it in the worker and let cf autocompress take over
                    const ds = new DecompressionStream('gzip');
                    body = obj.body.pipeThrough(ds);
                    headers.delete('content-encoding');
                    headers.delete('cache-control');
                }
                return new Response(body, { headers });
            }
            return await computeNotFound(bucket, 'GET');
        } else if (method === 'HEAD') {
            const obj = await bucket.head(key);
            if (obj) {
                return new Response(undefined, { headers: computeHeaders(obj) });
            }
            return await computeNotFound(bucket, 'HEAD');
        } else {
            return new Response(`Method '${method}' not allowed`, { status: 405 });
        }
    }

};

//

async function computeNotFound(bucket: R2Bucket, method: 'GET' | 'HEAD'): Promise<Response> {
    const key = '404.html';
    if (method === 'GET') {
        const obj = await bucket.get(key);
        if (obj) {
            return new Response(obj.body, { status: 404, headers: computeHeaders(obj) });
        }
    } else if (method === 'HEAD') {
        const obj = await bucket.head(key);
        if (obj) {
            return new Response(undefined, { status: 404, headers: computeHeaders(obj) });
        }
    }
    return new Response(method === 'GET' ? 'not found' : undefined, { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
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
