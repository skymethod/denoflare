import { IncomingRequestCf, IncomingRequestCfProperties } from './cloudflare_workers_types.d.ts';
import { DONamespaceProvider, GlobalCachesProvider, KVNamespaceProvider } from './cloudflare_workers_runtime.ts';
import { Binding } from './config.ts';
import { consoleLog } from './console.ts';
import { DurableObjectConstructor } from './in_process_durable_objects.ts';
import { cloneRequestWithHostname } from './fetch_util.ts';
import { ModuleWorkerExecution } from './module_worker_execution.ts';
import { ScriptWorkerExecution } from './script_worker_execution.ts';

export interface ModuleWorkerInfo {
    readonly moduleWorkerExportedFunctions: Record<string, DurableObjectConstructor>;
    readonly moduleWorkerEnv: Record<string, unknown>;
}

export interface WorkerExecutionCallbacks {
    globalCachesProvider: GlobalCachesProvider;
    kvNamespaceProvider: KVNamespaceProvider;
    doNamespaceProvider: DONamespaceProvider;
    incomingRequestCfPropertiesProvider: () => IncomingRequestCfProperties;
    onModuleWorkerInfo?: (info: ModuleWorkerInfo) => void;
}

export class WorkerExecution {
    private readonly callbacks: WorkerExecutionCallbacks;
    private readonly worker: ModuleWorkerExecution | ScriptWorkerExecution;

    private constructor(callbacks: WorkerExecutionCallbacks, worker: ModuleWorkerExecution | ScriptWorkerExecution) {
        this.callbacks = callbacks;
        this.worker = worker;
    }

    static async start(scriptPathOrUrl: string, scriptType: 'module' | 'script', bindings: Record<string, Binding>, callbacks: WorkerExecutionCallbacks): Promise<WorkerExecution> {
        const worker = scriptType === 'module' ? await ModuleWorkerExecution.create(scriptPathOrUrl, bindings, callbacks) 
            : await ScriptWorkerExecution.create(scriptPathOrUrl, bindings, callbacks);
        return new WorkerExecution(callbacks, worker);
        
    }

    async fetch(request: Request, opts: { cfConnectingIp: string, hostname?: string }): Promise<Response> {
        consoleLog(`${request.method} ${request.url}`);
        const cf = this.callbacks.incomingRequestCfPropertiesProvider();
        const req = makeIncomingRequestCf(request, cf, opts);
        return await this.worker.fetch(req);
    }
}

//

function makeIncomingRequestCf(request: Request, cf: IncomingRequestCfProperties, opts: { cfConnectingIp: string, hostname?: string }): IncomingRequestCf {
    const { cfConnectingIp, hostname } = opts;
    if (hostname) request = cloneRequestWithHostname(request, hostname);
    const req = new Request(request, { headers: [ ...request.headers, ['cf-connecting-ip', cfConnectingIp] ] });
    // deno-lint-ignore no-explicit-any
    (req as any).cf = cf;
    return req as IncomingRequestCf;
}
