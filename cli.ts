import { loadConfig, resolveBindings, resolveCredential } from './config_loader.ts';
import { consoleError, consoleLog } from './console.ts';
import { DenoflareResponse } from './denoflare_response.ts';
import { InProcessScriptServer } from './in_process_script_server.ts';
import { WorkerManager } from './worker_manager.ts';

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
const credential = await resolveCredential(config);

const runInProcess = !!script.localInProcess;
consoleLog(`runInProcess=${runInProcess}`);

const createLocalRequestServer = async (): Promise<LocalRequestServer> => {
    if (runInProcess) {
        const scriptType = script.path.endsWith('.ts') ? 'module' : 'script';
        return await InProcessScriptServer.start(script.path, scriptType, bindings, credential);
    } else {
        // start the host for the permissionless deno workers
        const workerManager = await WorkerManager.start();
    
        // run the cloudflare worker script inside deno worker
        const runScript = async () => {
            consoleLog(`runScript: ${script.path}`);
            const scriptContents = await Deno.readFile(script.path);
            try {
                await workerManager.run(scriptContents, { bindings, credential });
            } catch (e) {
                consoleError('Error running script', e);
                Deno.exit(1);
            }
        };
        await runScript();
    
        // when the script changes, recreate the deno worker
        const watcher = Deno.watchFs(script.path);
        (async () => {
            let timeoutId: number | undefined;
            for await (const event of watcher) {
                if (event.kind === 'modify' && event.paths.includes(script.path)) {
                    // a single file modification sends two modify events, so coalesce them
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(runScript, 500);
                }
            }
        })();
        return workerManager;
    }
}

const localRequestServer = await createLocalRequestServer();

// start local server
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
    consoleLog('fetchExternalIp: Fetching...');
    const start = Date.now();
    const trace = await (await fetch('https://cloudflare.com/cdn-cgi/trace')).text();
    const m = /ip=([^\s]*)/.exec(trace);
    if (!m) throw new Error(`computeExternalIp: Unexpected trace: ${trace}`);
    const externalIp = m[1];
    consoleLog(`fetchExternalIp: Determined to be ${externalIp} in ${Date.now() - start}ms`)
    return externalIp;
}

const computeExternalIp = memoize(fetchExternalIp);

async function handle(conn: Deno.Conn) {
    const httpConn = Deno.serveHttp(conn);
    for await (const { request, respondWith } of httpConn) {
        try {
            const cfConnectingIp = await computeExternalIp();
            const hostname = script.localHostname;
            const upgrade = request.headers.get('upgrade') || undefined;
            if (upgrade !== undefined) {
                // websocket upgrade request
                if (upgrade !== 'websocket') throw new Error(`Unsupported upgrade: ${upgrade}`);
                const { websocket, response } = Deno.upgradeWebSocket(request);
                websocket.onopen = () => consoleLog('cli: socket opened');
                websocket.onmessage = (e) => {
                    consoleLog('cli: socket message:', e.data);
                };
                websocket.onerror = (e) => consoleLog('cli: socket errored:', e);
                websocket.onclose = () => consoleLog('cli: socket closed');

                const res = await localRequestServer.fetch(request, { cfConnectingIp, hostname });
                if (DenoflareResponse.is(res) && res.init && res.init.webSocket) {
                    if (res.init?.status !== 101) throw new Error(`Bad response status: expected 101, found ${res.init?.status}`);
                    const serverWebsocket = res.getDenoflareServerWebSocket();
                    if (serverWebsocket === undefined) throw new Error(`Bad response: expected websocket`);
                    serverWebsocket.setRealWebsocket(websocket);
                }
                await respondWith(response).catch(e => consoleError(`Error in respondWith`, e));
            } else {
                // normal request
                let res = await localRequestServer.fetch(request, { cfConnectingIp, hostname });
                if (DenoflareResponse.is(res)) {
                    res = res.toRealResponse();
                }
                await respondWith(res).catch(e => consoleError(`Error in respondWith`, e));
            }
        } catch (e) {
            consoleError('Error servicing request', e);
        }
    }
}

const server = Deno.listen({ port });
consoleLog(`Local server running on http://localhost:${port}`);

for await (const conn of server) {
    handle(conn).catch(e => consoleError('Error in handle', e));
}

consoleLog('end of cli');

//

interface LocalRequestServer {
    fetch(request: Request, opts: { cfConnectingIp: string, hostname?: string }): Promise<Response>;
}
