import { isTextBinding, loadConfig } from './config.ts';
import { RpcChannel } from './rpc_channel.ts';
import { Bodies, makeBodyResolverOverRpc, PackedRequest, packRequest, packResponse, setReadBodyChunkRequestHandler, unpackResponse } from './rpc_fetch.ts';

if (Deno.args.length === 0) {
    throw new Error(`Must provide a script name argument`);
}

// wrap the script worker inside a permissionless deno worker wrapper
const config = await loadConfig();
const scriptName = Deno.args[0];
const script = config.scripts[scriptName];
if (script === undefined) throw new Error(`Script '${scriptName}' not found`);
const scriptText = Deno.readTextFileSync(script.path);
const result = await Deno.emit('worker.ts', {
    bundle: 'module',
});
console.log(result);

const bundleJs = result.files['deno:///bundle.js'];
const workerJsLines = [ bundleJs, '(function(){' ];
for (const [ name, binding ] of Object.entries(script.bindings)) {
    const value = isTextBinding(binding) ? `"${binding.value}"` : `"TODO"`;
    workerJsLines.push(`const ${name} = ${value};`);
}
workerJsLines.push(
    'const self = new Self();', 
    'const fetch = fetchOverRpc;', 
    scriptText, 
    'self.afterScript();', 
    '})();')
const workerJs = workerJsLines.join('\n');
const contents = new TextEncoder().encode(workerJs);
const blob = new Blob([contents]);
const url = URL.createObjectURL(blob);

// instantiate the permissionless deno worker
const w = new Worker(url, { deno: { namespace: false, permissions: 'none' }, type: 'module' });
const rpcChannel = new RpcChannel('host', w.postMessage.bind(w));
w.onerror = e => console.error('onerror', e);
w.onmessage = async event => {
    if (await rpcChannel.receiveMessage(event.data)) return;
};
w.onmessageerror = e => console.log('onmessageerror', e);

// make external fetch calls on behalf of the worker
const bodies = new Bodies();
rpcChannel.addRequestHandler('fetch', async requestData => {
    const { method, url, headers } = requestData as PackedRequest;
    const res = await fetch(url, { method, headers });
    return packResponse(res, bodies);
});
setReadBodyChunkRequestHandler(rpcChannel, bodies);

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
        await respondWith(res);
    }
}

const server = Deno.listen({ port: 8080 });

for await (const conn of server) {
    handle(conn);
}
