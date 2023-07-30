import { checkMatches } from '../common/check.ts';
import { CloudflareApi } from '../common/cloudflare_api.ts';
import { executeWithRetries } from '../common/sleep.ts';
import { Bytes } from '../examples/webtail-worker/deps_worker.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForConfig, loadConfig, resolveProfile } from './config_loader.ts';

export const AE_PROXY_COMMAND = denoflareCliCommand('ae-proxy', 'Host a proxy endpoint to Analytics Engine more compatible with Clickhouse plugins')
    .option('port', 'required-integer', `Local port to use`)
    .option('basic', 'string', 'Basic auth username/password to secure local proxy', { hint: 'user:pass' })
    .include(commandOptionsForConfig)
    .docsLink('/cli/ae-proxy')
    ;

export async function aeProxy(args: (string | number)[], options: Record<string, unknown>) {
    if (AE_PROXY_COMMAND.dumpHelp(args, options)) return;

    const opt = AE_PROXY_COMMAND.parse(args, options);
    const { port, verbose, basic } = opt;
    if (typeof basic === 'string') checkMatches('basic', basic, /^.+?:.+?$/);

    if (verbose) {
        CloudflareApi.DEBUG = true;
    }

    const config = await loadConfig(options);
    const { accountId, apiToken } = await resolveProfile(config, options);
    if (verbose) console.log({ accountId, apiToken });

    const server = Deno.serve({ port }, async (req, info) => { 
        const { hostname, port, transport } = info.remoteAddr;
        const { method, headers } = req;

        const res = await (async () => {

            // log request
            console.log(`${method} ${req.url}`);
            console.log(`  ${transport} ${hostname}:${port}`);
            for (const [ name, value ] of headers) {
                console.log(`  ${name}: ${value}`);
            }

            {
                // enforce basic auth
                const authorization = headers.get('authorization');
                if (typeof basic === 'string') {
                    if (typeof authorization === 'string') {
                        const m = /^Basic\s+([^\s]+)$/i.exec(authorization);
                        if (m) {
                            const clientBasic = Bytes.ofBase64(m[1]).utf8();
                            if (clientBasic !== basic) {
                                return new Response('forbidden', { status: 403 });
                            }
                        }
                    } else {
                        return new Response('unauthorized', { status: 401, headers: { 'www-authenticate': `Basic realm="denoflare ae-proxy"` } });
                    }
                }
            }

            // re-route queries to ae
            const { pathname, searchParams } = new URL(req.url);
            const aeQueryUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;
            const authorization = `Bearer ${apiToken}`;
            if (method === 'GET' && pathname === '/') {
                const { query, ...rest } = Object.fromEntries(searchParams);
                if (typeof query === 'string' && Object.keys(rest).length === 0) {
                    const u = new URL(aeQueryUrl);
                    if (verbose) console.log(query);
                    u.searchParams.set('query', computeQuery(query));
                    return await fetchAe(u, { method, headers: { authorization } });
                }
            } else if (method === 'POST' && pathname === '/') {
                const query = await req.text();
                if (verbose) console.log(query);
                return await fetchAe(aeQueryUrl, { method, headers: { authorization }, body: computeQuery(query) });
            }

            // otherwise 404
            return new Response('not found', { status: 404 });
        })();

        console.log(`${res.status} ${res.headers.get('content-type')}`);
        if (verbose) {
            const body = await res.text();
            console.log(body);
            return new Response(body, res);
        }
        return res;
    });
    console.log(`Local ae proxy running on http://localhost:${port}`);
    await server.finished;
}

//

function computeQuery(query: string): string {
    // ae doesn't handle /* inline comments */
    return query.replaceAll(/\/\*.*?\*\//g, ' ');
}

function fetchAe(url: string | URL, init: RequestInit): Promise<Response> {
    return executeWithRetries(async () => {
        const res = await fetch(url, init);
        if (res.status === 502) throw new TransientError(`Unexpected status: ${res.status}`); // ae sometimes returns 502 bad gateway
        return res;
    }, { tag: 'fetchAe', maxRetries: 3, isRetryable: e => e instanceof TransientError });
}

class TransientError extends Error {
    constructor(message: string) {
        super(message);
    }
}
