import { importBinary, importText, importWasm, IncomingRequestCf } from './deps.ts';
const exampleTxt = await importText(import.meta.url, './static/example.txt');
const denoPng = await importBinary(import.meta.url, './static/deno.png');
const wasmModule = await importWasm(import.meta.url, './static/hello.wasm');

// // instantiate wasm once-per-isolate, instead of once-per-request
const instance = new WebAssembly.Instance(wasmModule);
const main = (instance.exports.main as CallableFunction);

// via denoflare environment bindings: https://denoflare.dev/cli/configuration
type Env = { secret: string };

export default {

    // standard workers fetch handler
    async fetch(request: Request, env: Env): Promise<Response> {
        try {
            const { method, url, headers } = request;
            const { origin, hostname, pathname } = new URL(url);

            if (method !== 'GET') return new Response(`not supported`, { status: 405 });

            // main route
            if (pathname === '/' || pathname.endsWith('/multiplat-example')) {
                // closest cloudflare colo
                const { colo: nearCfColo } = Object.fromEntries((await ((await fetch('https://1.1.1.1/cdn-cgi/trace')).text())).split('\n').map(v => v.split('=')));

                const servedFromPlatform = hostname.endsWith('.workers.dev') ? 'Cloudflare Workers'
                    : hostname.endsWith('.supabase.co') ? 'Supabase Edge Functions'
                    : hostname.endsWith('.deno.dev') ? 'Deno Deploy'
                    : hostname.endsWith('.on.aws') ? 'AWS Lambda'
                    : '???';

                // platform-specific serving colo (e.g. region on supabase)
                const servedFromColo = (request as IncomingRequestCf).cf.colo; // available on all platforms
                // const servedFromColo = JSON.stringify(context);

                const lines = [
                    `👋 ${headers.get('cf-connecting-ip')}`, // available on all platforms
                    `Environment secret: ${env.secret}`,
                    `Result from imported hello.wasm call: ${main()}`,
                    `Imported static text: ${exampleTxt}`,
                    `Imported static binary: 👉 ${origin}${pathname === '/' ? '' : pathname}/deno.png`,
                    `Source code: 👉 https://github.com/skymethod/denoflare/blob/master/examples/multiplat-example/multiplat.ts`,
                    `Generated: ${new Date().toISOString()} on ${servedFromPlatform} (${servedFromColo}${nearCfColo === servedFromColo ? '' : `, near Cloudfare colo ${nearCfColo}`})`,
                ]
                const html = lines.join('\n\n');
                return new Response(html, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } }); // supabase does not allow html (yet): https://supabase.com/docs/guides/functions/debugging#limitations
            }

            // binary image route
            if (pathname.endsWith('/deno.png')) {
                return new Response(denoPng, { status: 200, headers: { 'content-type': 'image/png' } }); 
            }
    
            return new Response(`not found: ${url}`);
        } catch (e) {
            return new Response(`${e.stack || e}`, { status: 500 });
        }
    }

};
