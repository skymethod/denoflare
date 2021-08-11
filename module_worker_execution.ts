import { applyWorkerEnv, defineModuleGlobals } from './cloudflare_workers_runtime.ts';
import { Binding } from './config.ts';
import { consoleLog, consoleWarn } from './console.ts';
import { DurableObjectConstructor } from './in_process_durable_objects.ts';
import { SubtleCryptoPolyfill } from './subtle_crypto_polyfill.ts';
import { IncomingRequestCf, ModuleWorkerContext } from './deps_cf.ts';
import { WorkerExecutionCallbacks } from './worker_execution.ts';

export class ModuleWorkerExecution {
    private readonly worker: ModuleWorker;

    private constructor(worker: ModuleWorker) {
        this.worker = worker;
    }

    static async create(scriptPath: string, bindings: Record<string, Binding>, callbacks: WorkerExecutionCallbacks): Promise<ModuleWorkerExecution> {
        const { globalCachesProvider, onModuleWorkerInfo, kvNamespaceProvider, doNamespaceProvider } = callbacks;
        SubtleCryptoPolyfill.applyIfNecessary();
        defineModuleGlobals(globalCachesProvider);
        const module = await import(scriptPath);
        consoleLog(module);
        const moduleWorkerExportedFunctions: Record<string, DurableObjectConstructor> = {};
        for (const [ name, value ] of Object.entries(module)) {
            if (typeof value === 'function') {
                moduleWorkerExportedFunctions[name] = value as DurableObjectConstructor;
            }
        }
        const moduleWorkerEnv: Record<string, unknown> = {};
        if (onModuleWorkerInfo) onModuleWorkerInfo({ moduleWorkerExportedFunctions, moduleWorkerEnv });
        applyWorkerEnv(moduleWorkerEnv, bindings, kvNamespaceProvider, doNamespaceProvider);
        if (module === undefined) throw new Error('Bad module: undefined');
        if (module.default === undefined) throw new Error('Bad module.default: undefined');
        if (typeof module.default.fetch !== 'function') throw new Error(`Bad module.default.fetch: ${typeof module.default.fetch}`);
        return new ModuleWorkerExecution({ fetch: module.default.fetch, moduleWorkerEnv });
    }

    async fetch(request: IncomingRequestCf): Promise<Response> {
        return await this.worker.fetch(request, this.worker.moduleWorkerEnv, new DefaultModuleWorkerContext());
    }
}

//

interface ModuleWorker {
    readonly moduleWorkerEnv: Record<string, unknown>;
    // deno-lint-ignore no-explicit-any
    fetch(request: IncomingRequestCf, env: any, ctx: ModuleWorkerContext): Promise<Response>;
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
