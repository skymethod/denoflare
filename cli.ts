import { loadConfig, resolveBindings, resolveCredential } from './config_loader.ts';
import { InProcessScriptServer } from "./in_process_script_server.ts";
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

const createLocalRequestServer = async (): Promise<LocalRequestServer> => {
    if (runInProcess) {
        return await InProcessScriptServer.start(script.path, bindings, credential);
    } else {
        // start the host for the permissionless deno workers
        const workerManager = await WorkerManager.start();
    
        // run the cloudflare worker script inside deno worker
        const runScript = async () => {
            console.log(`runScript: ${script.path}`);
            const scriptContents = await Deno.readFile(script.path);
            try {
                await workerManager.run(scriptContents, { bindings, credential });
            } catch (e) {
                console.error(e);
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
        try {
            const res = await localRequestServer.fetch(request, await computeExternalIp());
            await respondWith(res).catch(e => console.log(`Error in respondWith`, e));
        } catch (e) {
            console.error('Error servicing request', e);
        }
    }
}

const server = Deno.listen({ port });
console.log(`Local server running on http://localhost:${port}`);

for await (const conn of server) {
    handle(conn).catch(e => console.error('error in handle', e));
}

console.log('end of cli');

//

interface LocalRequestServer {
    fetch(request: Request, cfConnectingIp: string): Promise<Response>;
}
