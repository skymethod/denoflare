import { defineScriptGlobals } from './cloudflare_workers_runtime.ts';
import { Binding } from './config.ts';
import { consoleLog, consoleWarn } from './console.ts';
import { IncomingRequestCf } from './cloudflare_workers_types.d.ts';
import { WorkerExecutionCallbacks } from './worker_execution.ts';

export class ScriptWorkerExecution {
    private readonly worker: ScriptWorker;

    private constructor(worker: ScriptWorker) {
        this.worker = worker;
    }

    static async create(scriptPath: string, bindings: Record<string, Binding>, callbacks: WorkerExecutionCallbacks): Promise<ScriptWorkerExecution> {
        const { globalCachesProvider, kvNamespaceProvider, doNamespaceProvider, r2BucketProvider, analyticsEngineProvider, d1DatabaseProvider, secretKeyProvider, emailSenderProvider, queueProvider, vpcServiceProvider, aiProvider } = callbacks;

        await defineScriptGlobals(bindings, globalCachesProvider, kvNamespaceProvider, doNamespaceProvider, r2BucketProvider, analyticsEngineProvider, d1DatabaseProvider, secretKeyProvider, emailSenderProvider, queueProvider, vpcServiceProvider, aiProvider);

        let fetchListener: EventListener | undefined;
        
        const addEventListener = (type: string, listener: EventListener) => {
            consoleLog(`script: addEventListener type=${type}`);
            if (type === 'fetch') {
                fetchListener = listener;
            }
        };
        // deno-lint-ignore no-explicit-any
        (self as any).addEventListener = addEventListener;

        await import(scriptPath);

        if (fetchListener === undefined) throw new Error(`Script did not add a fetch listener`);
        return new ScriptWorkerExecution({ fetchListener });
    }

    async fetch(request: IncomingRequestCf): Promise<Response> {
        const e = new FetchEvent(request);
        await this.worker.fetchListener(e);
        if (e.responseFn === undefined) throw new Error(`Event handler did not set a response using respondWith`);
        const response = await e.responseFn;
        return response;
    }
}

//

interface ScriptWorker {
    readonly fetchListener: EventListener;
}

class FetchEvent extends Event {
    readonly request: Request;
    responseFn: Promise<Response> | undefined;

    constructor(request: Request) {
        super('fetch');
        this.request = request;
    }

    waitUntil(promise: Promise<unknown>) {
        // consoleLog('waitUntil', promise);
        promise.then(() => { 
            // consoleLog(`waitUntil complete`); 
        }, e => consoleWarn(e));
    }

    respondWith(responseFn: Promise<Response>) {
        // consoleLog('respondWith', responseFn);
        if (this.responseFn) throw new Error(`respondWith: already called`);
        this.responseFn = responseFn;
    }
}
