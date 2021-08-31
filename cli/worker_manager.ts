import { ApiKVNamespace } from './api_kv_namespace.ts';
import { Profile, Binding } from '../common/config.ts';
import { consoleError, consoleLog } from '../common/console.ts';
import { RpcChannel } from '../common/rpc_channel.ts';
import { Bodies, PackedRequest, packResponse, addRequestHandlerForReadBodyChunk, packRequest, unpackResponse, makeBodyResolverOverRpc } from '../common/rpc_fetch.ts';
import { addRequestHandlerForRpcKvNamespace } from '../common/rpc_kv_namespace.ts';
import { runScript, WorkerFetch } from '../common/rpc_script.ts';
import { dirname, fromFileUrl, resolve } from './deps_cli.ts';

export class WorkerManager {
    private readonly workerUrl: string;

    private currentWorker?: WorkerInfo;

    private constructor(workerUrl: string) {
        this.workerUrl = workerUrl;
    }

    static async start(): Promise<WorkerManager> {
        // compile the permissionless deno worker (once)
       
        const webworkerRootSpecifier = computeWebworkerRootSpecifier();
        const result = await Deno.emit(webworkerRootSpecifier, {
            bundle: 'module',
        });
        consoleLog(result);
        const workerJs = result.files['deno:///bundle.js'];
        const contents = new TextEncoder().encode(workerJs);
        const blob = new Blob([contents]);
        const workerUrl = URL.createObjectURL(blob);
        return new WorkerManager(workerUrl);
    }

    async run(scriptContents: Uint8Array, scriptType: 'module' | 'script', opts: { bindings: Record<string, Binding>, profile: Profile }): Promise<void> {
        const { bindings, profile } = opts;

        if (this.currentWorker) {
            this.currentWorker.worker.terminate();
            this.currentWorker = undefined;
        }

        // instantiate the permissionless deno worker
        const worker = new Worker(this.workerUrl, { deno: { namespace: false, permissions: 'none' }, type: 'module' });

        // init rpc
        const rpcChannel = new RpcChannel('host', worker.postMessage.bind(worker));
        worker.onerror = e => consoleError('onerror', e);
        worker.onmessage = async event => {
            if (await rpcChannel.receiveMessage(event.data)) return;
        };
        worker.onmessageerror = e => consoleError('host: onmessageerror', e);

        // make external fetch calls on behalf of the worker
        const bodies = new Bodies();
        rpcChannel.addRequestHandler('fetch', async requestData => {
            const { method, url, headers } = requestData as PackedRequest;
            const res = await fetch(url, { method, headers });
            return await packResponse(res, bodies);
        });
        addRequestHandlerForReadBodyChunk(rpcChannel, bodies);

        // handle rpc kv requests, forward to cloudflare api
        const { accountId, apiToken } = profile;
        addRequestHandlerForRpcKvNamespace(rpcChannel, kvNamespace => new ApiKVNamespace(accountId, apiToken, kvNamespace));

        // run the script in the deno worker
        await runScript({ scriptContents, scriptType, bindings }, rpcChannel);

        this.currentWorker = { worker, rpcChannel, bodies };
    }

    async fetch(request: Request, opts: { cfConnectingIp: string, hostname?: string }): Promise<Response> {
        const { currentWorker } = this;
        if (currentWorker === undefined) throw new Error(`Must call run() before calling fetch()`);
        const { bodies, rpcChannel } = currentWorker;
        const packedRequest = packRequest(request, undefined, bodies);
        const workerFetch: WorkerFetch = {
            packedRequest, 
            opts,
        };
        const res = await rpcChannel.sendRequest('worker-fetch', workerFetch, responseData => {
            return unpackResponse(responseData, makeBodyResolverOverRpc(rpcChannel));
        });
        return res;
    }

}

//

function computeWebworkerRootSpecifier() {
    if (import.meta.url.startsWith('https://')) {
        const url = new URL(import.meta.url);
        const tokens = url.pathname.split('/');
        tokens.splice(tokens.length - 2);
        tokens.push('cli-webworker', 'worker.ts');
        url.pathname = tokens.join('/');
        return url.toString();
    } else {
        const thisPath = fromFileUrl(import.meta.url);
        const denoflareCliPath = dirname(thisPath);
        return resolve(denoflareCliPath, '..', 'cli-webworker', 'worker.ts');
    }
}

//

interface WorkerInfo {
    readonly rpcChannel: RpcChannel;
    readonly bodies: Bodies;
    readonly worker: Worker;
}
