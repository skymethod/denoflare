import type { KVNamespace } from 'https://raw.githubusercontent.com/skymethod/denoflare/v0.7.0/common/cloudflare_workers_types.d.ts'; // ironic

// https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/
// https://github.com/orgs/community/discussions/159123

export default {

    async fetch(request: Request, { repos, extensions, kv }: Env): Promise<Response> {
        // YES https://raw.githubusercontent.com/scope/repo/674af1a29c14ad9fae49f0839891de97fafee5f0/path/to/file.ts
        // YES https://raw.githubusercontent.com/scope/repo/v1.0.0/path/to/file.ts
        // NO  https://raw.githubusercontent.com/scope/repo/refs/heads/master/path/to/file.ts

        const { method } = request;
        const { pathname, searchParams } = new URL(request.url);
        const m = /^\/([a-z0-9]+\/[a-z0-9]+)\/([^/]+)\/.+?\.([a-z]+)$/.exec(pathname);
        if (m) {
            if (!(method === 'GET' || method === 'HEAD')) return new Response(`method not supported: ${method}`, { status: 405 });
            const [ _, scopedRepo, prefix, ext ] = m;
            if (!repos.split(',').includes(scopedRepo) || !extensions.split(',').includes(ext) || prefix === 'refs') return new Response('bad request', { status: 400 });

            console.log(pathname);

            const { accept, 'user-agent': userAgent } = Object.fromEntries(request.headers);
            const [ flush, nocache ] = [ 'flush', 'nocache' ].map(v => searchParams.has(v));

            Object.entries({ userAgent, accept, flush, nocache }).forEach(([ name, val ]) => {
                if (val) console.log(`${name}: ${val}`);
            });

            const cache = await caches.open('raw');
            const key = `http://cache${pathname}`;
            
            const saveToCache = async (headers: Headers, body: Uint8Array) => {
                console.log(`saving to cache`);
                await cache.put(key, new Response(body, { headers }));
            }

            if (!flush) {
                if (!nocache) {
                    const cachedResponse = await cache.match(key);
                    if (cachedResponse) {
                        console.log(`found in cache`);
                        return cachedResponse;
                    }
                }

                const kvResult = await kv.getWithMetadata(key, { type: 'arrayBuffer' });
                if (kvResult && kvResult.value) {
                    const headers = new Headers(Object.entries(kvResult.metadata ?? {}).filter(v => typeof v[1] === 'string') as [ string, string ][]);
                    const body = new Uint8Array(kvResult.value);
                    if (body.length > 0) {
                        console.log(`found in kv: ${body.byteLength} bytes`);
                        await saveToCache(headers, body);
                        return new Response(body, { headers });
                    } else {
                        console.log(`kv body empty! ${JSON.stringify({ keys: Object.keys(kvResult) })}`);
                    }
                }
            }

            const res = await fetch(`https://raw.githubusercontent.com${pathname}`);
            if (res.status !== 200) {
                console.log(`bad fetch response: ${res.status}`);
                return res;
            }

            const body = await res.bytes();
            console.log(`fetched ${body.length} bytes, save to cache/kv, return`)
            
            await saveToCache(new Headers(res.headers), body);

            await kv.put(key, body, { metadata: Object.fromEntries(res.headers) });

            return new Response(method === 'HEAD' ? null : body, { headers: res.headers });
        }
        return new Response('not found', { status: 404 });
    }

}

type Env = {
    repos: string, // comma-delimited allowed scope/repo names
    extensions: string, // comma-delimited allowed extensions (e.g. ts)
    kv: KVNamespace,
}
