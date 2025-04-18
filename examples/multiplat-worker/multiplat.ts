import { importBinary, importText, importWasm, IncomingRequestCf } from './deps.ts';

// import external text/binary/wasm assets, available on all platforms!
const exampleTxt = await importText(import.meta.url, './static/example.txt');
const denoPng = await importBinary(import.meta.url, './static/deno.png');
const wasmModule = await importWasm(import.meta.url, './static/hello.wasm');

// instantiate wasm once-per-isolate, instead of once-per-request
const instance = new WebAssembly.Instance(wasmModule);
const main = (instance.exports.main as CallableFunction);

// via denoflare environment bindings: https://denoflare.dev/cli/configuration
type Env = { secret?: string, cloudflareUrl?: string, supabaseUrl?: string, deployUrl?: string, lambdaUrl?: string };

export default {

    // standard workers fetch handler
    async fetch(request: Request, env: Env): Promise<Response> {
        try {
            const { method, url, headers } = request;
            const { origin, hostname, pathname } = new URL(url);

            // only handle GET requests
            if (method !== 'GET') return new Response(`${method} not supported`, { status: 405 });

            // main route
            if (pathname === '/' || pathname.endsWith('/multiplat-example')) {

                // detect closest cloudflare colo
                const { colo: nearCfColo } = Object.fromEntries((await ((await fetch('https://1.1.1.1/cdn-cgi/trace')).text())).split('\n').map(v => v.split('=')));

                // detect platform
                const platform = hostname.endsWith('.workers.dev') ? 'cloudflare'
                    : hostname.endsWith('.supabase.co') ? 'supabase'
                    : hostname.endsWith('.deno.dev') ? 'deploy'
                    : hostname.endsWith('.on.aws') ? 'lambda'
                    : undefined;

                const computePlatformName = (platform: string | undefined) =>  ({ cloudflare: 'Cloudflare Workers', supabase: 'Supabase Edge Functions', deploy: 'Deno Deploy', lambda: 'AWS Lambda' } as Record<string, string>)[platform ?? ''] ?? '???';
                const servedFromPlatform = computePlatformName(platform) ?? '???';
                
                // platform-specific serving colo (e.g. region on supabase)
                const servedFromColo = (request as IncomingRequestCf).cf.colo; // available on all platforms

                // public urls to same example on other platforms
                const exampleUrls: Record<string, string | undefined> = { cloudflare: env.cloudflareUrl, supabase: env.supabaseUrl, deploy: env.deployUrl, lambda: env.lambdaUrl };

                // obtain requester ip
                const requesterIp = headers.get('cf-connecting-ip'); // available on all platforms

                // return a plain-text result, since supabase does not allow html: https://supabase.com/docs/guides/functions/debugging#limitations
                const lines = [
                    `👋 ${requesterIp} from ${computePlatformName(platform)}!`,
                    `Environment secret: ${env.secret}`,
                    `Result from imported hello.wasm call: ${main()}`,
                    `Imported static text: ${exampleTxt}`,
                    `Imported static binary: 👉 ${origin}${pathname === '/' ? '' : pathname}/deno.png`,
                    `Source code: 👉 https://github.com/skymethod/denoflare/blob/master/examples/multiplat-worker/multiplat.ts`,
                    `Generated: ${new Date().toISOString()} on ${servedFromPlatform} (${servedFromColo}${nearCfColo === servedFromColo ? '' : `, near Cloudfare colo ${nearCfColo}`})`,
                    [ 'cloudflare', 'deploy', 'lambda', 'supabase' ].flatMap(v => platform !== v && exampleUrls[v] ? [ `\nSame worker running on ${computePlatformName(v)}: 👉 ${exampleUrls[v]}` ] : []).join(''),
                ]
                return new Response(lines.join('\n\n'), { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
            }

            // binary image route
            if (pathname.endsWith('/deno.png')) {
                return new Response(denoPng, { status: 200, headers: { 'content-type': 'image/png' } }); 
            }
    
            return new Response(`not found: ${url}`, { status: 404 });
        } catch (e) {
            return new Response(`${(e as Error).stack || e}`, { status: 500 });
        }
    }

};
