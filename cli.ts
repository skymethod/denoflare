import { ApiKVNamespace } from './api_kv_namespace.ts';
import { loadConfig, resolveBindings, resolveCredential } from './config_loader.ts';
import { RpcChannel } from './rpc_channel.ts';
import { Bodies, makeBodyResolverOverRpc, PackedRequest, packRequest, packResponse, addRequestHandlerForReadBodyChunk, unpackResponse } from './rpc_fetch.ts';
import { addRequestHandlerForRpcKvNamespace } from './rpc_kv_namespace.ts';
import { runScript } from './rpc_script.ts';

if (Deno.args.length === 0) {
    throw new Error(`Must provide a script name argument`);
}

// read the script-based cloudflare worker contents
const config = await loadConfig();
const scriptName = Deno.args[0];
const script = config.scripts[scriptName];
if (script === undefined) throw new Error(`Script '${scriptName}' not found`);
const port = script.localPort || 8080;
const bindings = await resolveBindings(script.bindings, port);
const scriptContents = await Deno.readFile(script.path);

// compile the permissionless deno worker
const result = await Deno.emit('worker.ts', {
    bundle: 'module',
});
console.log(result);

// instantiate the permissionless deno worker
const workerJs = result.files['deno:///bundle.js'];
const contents = new TextEncoder().encode(workerJs);
const blob = new Blob([contents]);
const url = URL.createObjectURL(blob);
const w = new Worker(url, { deno: { namespace: false, permissions: 'none' }, type: 'module' });

// init rpc
const rpcChannel = new RpcChannel('host', w.postMessage.bind(w));
w.onerror = e => console.error('onerror', e);
w.onmessage = async event => {
    if (await rpcChannel.receiveMessage(event.data)) return;
};
w.onmessageerror = e => console.log('host: onmessageerror', e);

// make external fetch calls on behalf of the worker
const bodies = new Bodies();
rpcChannel.addRequestHandler('fetch', async requestData => {
    const { method, url, headers } = requestData as PackedRequest;
    const res = await fetch(url, { method, headers });
    return packResponse(res, bodies);
});
addRequestHandlerForReadBodyChunk(rpcChannel, bodies);

// handle rpc kv requests, forward to cloudflare api
const { accountId, apiToken } = await resolveCredential(config);
addRequestHandlerForRpcKvNamespace(rpcChannel, kvNamespace => new ApiKVNamespace(accountId, apiToken, kvNamespace));

// run the script in the deno worker
try {
    await runScript({ scriptContents, bindings }, rpcChannel);
} catch (e) {
    console.error(e);
    Deno.exit(1);
}

// start local server, send requests to deno worker
function memoize<T>(fn: () => Promise<T>): () => Promise<T> {
    let cached: T | undefined;
    return async () => {
        if (cached !== undefined) return cached;
        const rt = await fn();
        cached = rt;
        return rt;
    }
}

async function fetchExternalIp(): Promise<string> {
    console.log('fetchExternalIp: Fetching...');
    const start = Date.now();
    const trace = await (await fetch('https://cloudflare.com/cdn-cgi/trace')).text();
    const m = /ip=([^\s]*)/.exec(trace);
    if (!m) throw new Error(`computeExternalIp: Unexpected trace: ${trace}`);
    const externalIp = m[1];
    console.log(`fetchExternalIp: Determined to be ${externalIp} in ${Date.now() - start}ms`)
    return externalIp;
}

const computeExternalIp = memoize(fetchExternalIp);

async function handle(conn: Deno.Conn) {
    const httpConn = Deno.serveHttp(conn);
    for await (const { request, respondWith } of httpConn) {
        const packedRequest = packRequest(request, undefined, bodies);
        packedRequest.headers.push(['cf-connecting-ip', await computeExternalIp()]);
        const res = await rpcChannel.sendRequest('fetch', packedRequest, responseData => {
            return unpackResponse(responseData, makeBodyResolverOverRpc(rpcChannel));
        });
        try {
            await respondWith(res);
        } catch (e) {
            console.error('Error in respondWith', e);
        }
    }
}

const server = Deno.listen({ port });
console.log(`Local server running on http://localhost:${port}`)
for await (const conn of server) {
    handle(conn);
}
