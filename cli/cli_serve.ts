import { loadConfig, resolveBindings, resolveProfile } from './config_loader.ts';
import { consoleError, consoleLog } from '../common/console.ts';
import { DenoflareResponse } from '../common/denoflare_response.ts';
import { LocalDurableObjects } from '../common/local_durable_objects.ts';
import { NoopCfGlobalCaches } from '../common/noop_cf_global_caches.ts';
import { WorkerManager } from './worker_manager.ts';
import { ApiKVNamespace } from './api_kv_namespace.ts';
import { WorkerExecution, WorkerExecutionCallbacks } from '../common/worker_execution.ts';
import { makeIncomingRequestCfProperties } from '../common/incoming_request_cf_properties.ts';
import { UnimplementedDurableObjectNamespace } from '../common/unimplemented_cloudflare_stubs.ts';
import { ModuleWatcher } from './module_watcher.ts';
import { CLI_VERSION } from './cli_version.ts';
import { Binding, Isolation, Script } from '../common/config.ts';

export async function serve(args: (string | number)[], options: Record<string, unknown>) {
    const scriptReference = args[0];
    if (options.help || typeof scriptReference !== 'string') {
        dumpHelp();
        return;
    }

    const verbose = !!options.verbose;
    if (verbose) {
        ModuleWatcher.VERBOSE = verbose;
    }

    const scriptUrl = scriptReference.startsWith('https://') ? new URL(scriptReference) : undefined;
    if (scriptUrl && !scriptUrl.pathname.endsWith('.ts')) throw new Error('Url-based module workers must end in .ts');
    const scriptName = scriptUrl ? undefined : scriptReference;
    
    // read the script-based cloudflare worker contents
    const config = await loadConfig();
    let port = 8080;
    let bindings: Record<string, Binding> = {};
    let isolation: Isolation = 'isolate';
    let script: Script | undefined;
    let localHostname: string | undefined;
    if (scriptName) {
        script = config.scripts && config.scripts[scriptName];
        if (script === undefined) throw new Error(`Script '${scriptName}' not found`);
        if (script.localPort) port = script.localPort;
        bindings = await resolveBindings(script.bindings, port);
        isolation = script.localIsolation || isolation;
        localHostname = script.localHostname;
    } else {
        if (typeof options.port === 'number') {
            port = options.port;
        }
    }
    const profile = await resolveProfile(config);

    consoleLog(`isolation=${isolation}`);

    const computeScriptContents = async (scriptPathOrModuleWorkerUrl: string, scriptType: 'module' | 'script'): Promise<Uint8Array> => {
        if (scriptType === 'script') {
            if (scriptPathOrModuleWorkerUrl.startsWith('https://')) throw new Error('Url-based script workers not supported yet');
            return await Deno.readFile(scriptPathOrModuleWorkerUrl);
        }
        const start = Date.now();
        const result = await Deno.emit(scriptPathOrModuleWorkerUrl, {
            bundle: 'module',
        });
        consoleLog(result);
        const workerJs = result.files['deno:///bundle.js'];
        const rt = new TextEncoder().encode(workerJs);
        console.log(`Compiled ${scriptPathOrModuleWorkerUrl} into module contents in ${Date.now() - start}ms`);
        return rt;
    }

    const scriptPathOrUrl = scriptUrl ? scriptUrl.toString() : script!.path;

    const createLocalRequestServer = async (): Promise<LocalRequestServer> => {
        const scriptType = scriptPathOrUrl.endsWith('.ts') ? 'module' : 'script';
        if (isolation === 'none') {
            const { accountId, apiToken } = profile;
            let objects: LocalDurableObjects | undefined; 
            const callbacks: WorkerExecutionCallbacks = {
                onModuleWorkerInfo: moduleWorkerInfo => { 
                    const { moduleWorkerExportedFunctions, moduleWorkerEnv } = moduleWorkerInfo;
                    objects = new LocalDurableObjects(moduleWorkerExportedFunctions, moduleWorkerEnv);
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
            return await WorkerExecution.start(scriptPathOrUrl, scriptType, bindings, callbacks);
        } else {
            // start the host for the permissionless deno workers
            const workerManager = await WorkerManager.start();
        
            // run the cloudflare worker script inside deno worker
            const runScript = async () => {
                consoleLog(`runScript: ${scriptPathOrUrl}`);

                const scriptContents = await computeScriptContents(scriptPathOrUrl, scriptType);
                try {
                    await workerManager.run(scriptContents, scriptType, { bindings, profile });
                } catch (e) {
                    consoleError('Error running script', e);
                    Deno.exit(1);
                }
            };
            await runScript();
        
            // when a file-based script changes, recreate the deno worker
            if (script) {
                const _moduleWatcher = new ModuleWatcher(scriptPathOrUrl, runScript);
            }
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
                const hostname = localHostname;
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

//

function dumpHelp() {
    const lines = [
        `denoflare-serve ${CLI_VERSION}`,
        'Run a worker script on a local web server',
        '',
        'USAGE:',
        '    denoflare serve [FLAGS] [OPTIONS] [--] [script-reference]',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'OPTIONS:',
        '        --port <number>     Local port to use for the http server (default: 8080)',
        '',
        'ARGS:',
        '    <script-reference>    Name of script defined in .denoflare config, or an https url to a module-based worker .ts, e.g. https://path/to/worker.ts',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
