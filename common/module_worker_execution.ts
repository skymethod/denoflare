import { applyWorkerEnv, defineModuleGlobals } from './cloudflare_workers_runtime.ts';
import { Binding } from './config.ts';
import { consoleLog, consoleWarn } from './console.ts';
import { DurableObjectConstructor } from './local_durable_objects.ts';
import { IncomingRequestCf, ModuleWorkerContext } from './cloudflare_workers_types.d.ts';
import { WorkerExecutionCallbacks } from './worker_execution.ts';

export class ModuleWorkerExecution {
    static VERBOSE = false;
    private readonly worker: ModuleWorker;

    private constructor(worker: ModuleWorker) {
        this.worker = worker;
    }

    static async create(scriptPath: string, bindings: Record<string, Binding>, callbacks: WorkerExecutionCallbacks): Promise<ModuleWorkerExecution> {
        const { globalCachesProvider, webSocketPairProvider, onModuleWorkerInfo, kvNamespaceProvider, doNamespaceProvider, r2BucketProvider, analyticsEngineProvider, d1DatabaseProvider } = callbacks;
        defineModuleGlobals(globalCachesProvider, webSocketPairProvider);
        const module = await import(scriptPath);
        if (ModuleWorkerExecution.VERBOSE) consoleLog('ModuleWorkerExecution: module', module);
        const moduleWorkerExportedFunctions: Record<string, DurableObjectConstructor> = {};
        for (const [ name, value ] of Object.entries(module)) {
            if (typeof value === 'function') {
                moduleWorkerExportedFunctions[name] = value as DurableObjectConstructor;
            }
        }
        const moduleWorkerEnv: Record<string, unknown> = {};
        if (onModuleWorkerInfo) onModuleWorkerInfo({ moduleWorkerExportedFunctions, moduleWorkerEnv });
        applyWorkerEnv(moduleWorkerEnv, bindings, kvNamespaceProvider, doNamespaceProvider, r2BucketProvider, analyticsEngineProvider, d1DatabaseProvider);
        if (module === undefined) throw new Error('Bad module: undefined');
        if (module.default === undefined) throw new Error('Bad module.default: undefined');
        if (typeof module.default.fetch !== 'function') throw new Error(`Bad module.default.fetch: ${typeof module.default.fetch}`);
        if (module.default.alarm !== undefined && typeof module.default.alarm !== 'function') throw new Error(`Bad module.default.alarm: ${typeof module.default.alarm}`);
        return new ModuleWorkerExecution({ fetch: module.default.fetch, alarm: module.default.alarm, moduleWorkerEnv });
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
    alarm?(): Promise<void>;
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
