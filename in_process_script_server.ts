import { ModuleWorkerContext } from './deps_cf.ts';
import { ApiKVNamespace } from './api_kv_namespace.ts';
import { applyWorkerEnv, defineModuleGlobals, defineScriptGlobals, dispatchFetchEvent } from './cloudflare_workers_runtime.ts';
import { Binding, Credential } from './config.ts';
import { consoleLog, consoleWarn } from './console.ts';
import { DurableObjectConstructor, InProcessDurableObjects } from './in_process_durable_objects.ts';
import { SubtleCryptoPolyfill } from './subtle_crypto_polyfill.ts';
import { UnimplementedDurableObjectNamespace } from './unimplemented_cloudflare_stubs.ts';

export class InProcessScriptServer {

    private readonly handler: Handler;

    private constructor(handler: Handler) {
        this.handler = handler;
    }

    static async start(scriptPath: string, scriptType: 'script' | 'module', bindings: Record<string, Binding>, credential: Credential): Promise<InProcessScriptServer> {
        const { accountId, apiToken } = credential;

        SubtleCryptoPolyfill.applyIfNecessary();

        if (scriptType === 'module') {
            defineModuleGlobals();
            const module = await import(scriptPath);
            consoleLog(module);
            const moduleWorkerExportedFunctions: Record<string, DurableObjectConstructor> = {};
            for (const [ name, value ] of Object.entries(module)) {
                if (typeof value === 'function') {
                    moduleWorkerExportedFunctions[name] = value as DurableObjectConstructor;
                }
            }
            const moduleWorkerEnv: Record<string, unknown> = {};
            const objects = new InProcessDurableObjects(moduleWorkerExportedFunctions, moduleWorkerEnv);
            applyWorkerEnv(moduleWorkerEnv, bindings, kvNamespace => new ApiKVNamespace(accountId, apiToken, kvNamespace), doNamespace => objects.resolveDoNamespace(doNamespace));
            if (module === undefined) throw new Error('Bad module: undefined');
            if (module.default === undefined) throw new Error('Bad module.default: undefined');
            if (typeof module.default.fetch !== 'function') throw new Error(`Bad module.default.fetch: ${typeof module.default.fetch}`);
            return new InProcessScriptServer({ kind: 'module', fetch: module.default.fetch, moduleWorkerEnv });
        } else {
            defineScriptGlobals(bindings, kvNamespace => new ApiKVNamespace(accountId, apiToken, kvNamespace), doNamespace => new UnimplementedDurableObjectNamespace(doNamespace));

            let fetchListener: EventListener | undefined;
        
            const addEventListener = (type: string, listener: EventListener) => {
                consoleLog(`worker: addEventListener type=${type}`);
                if (type === 'fetch') {
                    fetchListener = listener;
                }
            };
            // deno-lint-ignore no-explicit-any
            (self as any).addEventListener = addEventListener;

            await import(scriptPath);

            if (fetchListener === undefined) throw new Error(`Script did not add a fetch listener`);

            return new InProcessScriptServer({ kind: 'script', fetchListener });
        }
    }

    async fetch(request: Request, opts: { cfConnectingIp: string, hostname?: string }): Promise<Response> {
        consoleLog(`${request.method} ${request.url}`);
        const { cfConnectingIp, hostname } = opts;
        if (hostname) request = cloneRequestWithHostname(request, hostname);
        const req = new Request(request, { headers: [ ...request.headers, ['cf-connecting-ip', cfConnectingIp] ] });
        const cf = { colo: 'DNO' };
        if (this.handler.kind === 'script') {
            return await dispatchFetchEvent(req, cf, this.handler.fetchListener);
        } else {
            // deno-lint-ignore no-explicit-any
            (req as any).cf = cf;
            return await this.handler.fetch(req, this.handler.moduleWorkerEnv, new DefaultModuleWorkerContext());
        }
    }
}

//

function cloneRequestWithHostname(request: Request, hostname: string): Request {
    const url = new URL(request.url);
    if (url.hostname === hostname) return request;
    const newUrl = url.origin.replace(url.host, hostname) + request.url.substring(url.origin.length);
    console.log(`${url} + ${hostname} = ${newUrl}`);
    const { method, headers } = request;
    const body = (method === 'GET' || method === 'HEAD') ? undefined : request.body;
    return new Request(newUrl, { method, headers, body });
}

//

type Handler = ScriptHandler | ModuleHandler;

interface ScriptHandler {
    readonly kind: 'script';
    readonly fetchListener: EventListener;
}

interface ModuleHandler {
    readonly kind: 'module';
    readonly moduleWorkerEnv: Record<string, unknown>;
    // deno-lint-ignore no-explicit-any
    fetch(request: Request, env: any, ctx: ModuleWorkerContext): Promise<Response>;
}

class DefaultModuleWorkerContext implements ModuleWorkerContext {

    passThroughOnException(): void {
        // noop
    }

    waitUntil(promise: Promise<unknown>): void {
        // consoleLog('waitUntil', promise);
        promise.then(() => { 
            // consoleLog(`waitUntil complete`); 
        }, e => consoleWarn(e));
    }

}
