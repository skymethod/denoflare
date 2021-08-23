import { loadConfig, resolveBindings, resolveCredential } from './config_loader.ts';
import { consoleError, consoleLog } from '../common/console.ts';
import { DenoflareResponse } from '../common/denoflare_response.ts';
import { InProcessDurableObjects } from '../common/in_process_durable_objects.ts';
import { NoopCfGlobalCaches } from '../common/noop_cf_global_caches.ts';
import { WorkerManager } from './worker_manager.ts';
import { ApiKVNamespace } from './api_kv_namespace.ts';
import { WorkerExecution, WorkerExecutionCallbacks } from '../common/worker_execution.ts';
import { makeIncomingRequestCfProperties } from '../common/incoming_request_cf_properties.ts';
import { UnimplementedDurableObjectNamespace } from '../common/unimplemented_cloudflare_stubs.ts';
import { ModuleWatcher } from './module_watcher.ts';

export async function serve(args: (string | number)[], options: Record<string, unknown>) {
    const scriptName = args[0];
    if (options.help || typeof scriptName !== 'string') {
        console.log('serve help!');
        return;
    }

    const verbose = !!options.verbose;
    if (verbose) {
        ModuleWatcher.VERBOSE = verbose;
    }
    
    // read the script-based cloudflare worker contents
    const config = await loadConfig();
    const script = config.scripts[scriptName];
    if (script === undefined) throw new Error(`Script '${scriptName}' not found`);
    const port = script.localPort || 8080;
    const bindings = await resolveBindings(script.bindings, port);
    const credential = await resolveCredential(config);

    const runInProcess = !!script.localInProcess;
    consoleLog(`runInProcess=${runInProcess}`);

    const computeScriptContents = async (scriptPath: string, scriptType: 'module' | 'script'): Promise<Uint8Array> => {
        if (scriptType === 'script') return await Deno.readFile(scriptPath);
        const start = Date.now();
        const result = await Deno.emit(scriptPath, {
            bundle: 'module',
        });
        consoleLog(result);
        const workerJs = result.files['deno:///bundle.js'];
        const rt = new TextEncoder().encode(workerJs);
        console.log(`Compiled ${scriptPath} into module contents in ${Date.now() - start}ms`);
        return rt;
    }

    const createLocalRequestServer = async (): Promise<LocalRequestServer> => {
        const scriptType = script.path.endsWith('.ts') ? 'module' : 'script';
        if (runInProcess) {
            const { accountId, apiToken } = credential;
            let objects: InProcessDurableObjects | undefined; 
            const callbacks: WorkerExecutionCallbacks = {
                onModuleWorkerInfo: moduleWorkerInfo => { 
                    const { moduleWorkerExportedFunctions, moduleWorkerEnv } = moduleWorkerInfo;
                    objects = new InProcessDurableObjects(moduleWorkerExportedFunctions, moduleWorkerEnv);
                },
                globalCachesProvider: () => new NoopCfGlobalCaches(),
                kvNamespaceProvider: kvNamespace => new ApiKVNamespace(accountId, apiToken, kvNamespace),
                doNamespaceProvider: doNamespace => {
                    // console.log(`doNamespaceProvider`, doNamespace, objects);
                    if (objects === undefined) return new UnimplementedDurableObjectNamespace(doNamespace);
                    return objects.resolveDoNamespace(doNamespace);
                },
                incomingRequestCfPropertiesProvider: () => makeIncomingRequestCfProperties(),
            };
            return await WorkerExecution.start(script.path, scriptType, bindings, callbacks);
        } else {
            // start the host for the permissionless deno workers
            const workerManager = await WorkerManager.start();
        
            // run the cloudflare worker script inside deno worker
            const runScript = async () => {
                consoleLog(`runScript: ${script.path}`);

                const scriptContents = await computeScriptContents(script.path, scriptType);
                try {
                    await workerManager.run(scriptContents, scriptType, { bindings, credential });
                } catch (e) {
                    consoleError('Error running script', e);
                    Deno.exit(1);
                }
            };
            await runScript();
        
            // when the script changes, recreate the deno worker
            const _moduleWatcher = new ModuleWatcher(script.path, runScript);
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
                    const { socket, response } = Deno.upgradeWebSocket(request);
                    socket.onopen = () => consoleLog('cli: socket opened');
                    socket.onmessage = (e) => {
                        consoleLog('cli: socket message:', e.data);
                    };
                    socket.onerror = (e) => consoleLog('cli: socket errored:', e);
                    socket.onclose = () => consoleLog('cli: socket closed');

                    const res = await localRequestServer.fetch(request, { cfConnectingIp, hostname });
                    if (DenoflareResponse.is(res) && res.init && res.init.webSocket) {
                        if (res.init?.status !== 101) throw new Error(`Bad response status: expected 101, found ${res.init?.status}`);
                        const serverWebsocket = res.getDenoflareServerWebSocket();
                        if (serverWebsocket === undefined) throw new Error(`Bad response: expected websocket`);
                        serverWebsocket.setRealWebsocket(socket);
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
}

//

interface LocalRequestServer {
    fetch(request: Request, opts: { cfConnectingIp: string, hostname?: string }): Promise<Response>;
}
