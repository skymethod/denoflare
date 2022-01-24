import { ApiKVNamespace } from './api_kv_namespace.ts';
import { Profile, Binding } from '../common/config.ts';
import { consoleError, consoleLog } from '../common/console.ts';
import { RpcChannel } from '../common/rpc_channel.ts';
import { Bodies, PackedRequest, packResponse, addRequestHandlerForReadBodyChunk, packRequest, unpackResponse, makeBodyResolverOverRpc } from '../common/rpc_fetch.ts';
import { addRequestHandlerForRpcKvNamespace } from '../common/rpc_kv_namespace.ts';
import { runScript, WorkerFetch } from '../common/rpc_script.ts';
import { dirname, fromFileUrl, resolve } from './deps_cli.ts';
import { DenoflareResponse } from '../common/denoflare_response.ts';
import { RpcHostWebSockets } from './rpc_host_web_sockets.ts';
import { makeRpcHostDurableObjectStorage } from './rpc_host_durable_object_storage.ts';
import { emit } from './emit.ts';

export class WorkerManager {
    static VERBOSE = false;

    private readonly workerUrl: string;

    private currentWorker?: WorkerInfo;

    private constructor(workerUrl: string) {
        this.workerUrl = workerUrl;
    }

    static async start(): Promise<WorkerManager> {
        // compile the permissionless deno worker (once)
        const webworkerRootSpecifier = computeWebworkerRootSpecifier();
        consoleLog(`Compiling ${webworkerRootSpecifier} into worker contents...`);
        const start = Date.now();
        const workerJs = await emit(webworkerRootSpecifier);
        if (WorkerManager.VERBOSE) consoleLog(workerJs);
        const contents = new TextEncoder().encode(workerJs);
        const blob = new Blob([contents]);
        const workerUrl = URL.createObjectURL(blob);
        consoleLog(`Compiled ${webworkerRootSpecifier} into worker contents in ${Date.now() - start}ms`);
        return new WorkerManager(workerUrl);
    }

    async run(scriptContents: Uint8Array, scriptType: 'module' | 'script', opts: { bindings: Record<string, Binding>, profile: Profile | undefined }): Promise<void> {
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

        // host side of the rpc do storage impl
        makeRpcHostDurableObjectStorage(rpcChannel);
        // host side of the rpc websocket impl
        const rpcHostWebSockets = new RpcHostWebSockets(rpcChannel);

        // make external fetch calls on behalf of the worker
        const bodies = new Bodies();
        const requestBodyResolver = makeBodyResolverOverRpc(rpcChannel);
        rpcChannel.addRequestHandler('fetch', async requestData => {
            const { method, url, headers, bodyId } = requestData as PackedRequest;
            const body = bodyId === undefined ? undefined : requestBodyResolver(bodyId);
            const res = await fetch(url, { method, headers, body });
            let overrideContentType: string | undefined;
            if (url.startsWith('file://')) {
                const importType = new URL(url).searchParams.get('import');
                if (importType === 'wasm') {
                    // application/wasm content-type required for WebAssembly.instantiate
                    // but no content type is returned for any local file fetches
                    // https://github.com/denoland/deno/issues/11925
                    overrideContentType = 'application/wasm'; 
                } else if (importType === 'text') {
                    overrideContentType = 'text/plain';
                } else if (importType === 'binary') {
                    overrideContentType = 'application/octet-stream';
                } else {
                    throw new Error(`Only wasm, text & binary import file fetches are allowed from a permissionless worker`);
                }
            }
            const packed = await packResponse(res, bodies, v => rpcHostWebSockets.packWebSocket(v), overrideContentType);
            return { data: packed, transfer: packed.bodyBytes ? [ packed.bodyBytes.buffer ] : [] };
        });
        addRequestHandlerForReadBodyChunk(rpcChannel, bodies);

        // handle rpc kv requests, forward to cloudflare api
        addRequestHandlerForRpcKvNamespace(rpcChannel, kvNamespace => ApiKVNamespace.ofProfile(profile, kvNamespace));

        // run the script in the deno worker
        await runScript({ scriptContents, scriptType, bindings, verbose: WorkerManager.VERBOSE }, rpcChannel);

        this.currentWorker = { worker, rpcChannel, bodies, rpcHostWebSockets };
    }

    async fetch(request: Request, opts: { cfConnectingIp: string, hostname?: string }): Promise<Response | DenoflareResponse> {
        const { currentWorker } = this;
        if (currentWorker === undefined) throw new Error(`Must call run() before calling fetch()`);
        const { bodies, rpcChannel, rpcHostWebSockets } = currentWorker;
        const packedRequest = packRequest(request, undefined, bodies);
        const workerFetch: WorkerFetch = {
            packedRequest, 
            opts,
        };
        const res = await rpcChannel.sendRequest('worker-fetch', workerFetch, responseData => {
            return unpackResponse(responseData, makeBodyResolverOverRpc(rpcChannel), v => rpcHostWebSockets.unpackWebSocket(v));
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
    readonly rpcHostWebSockets: RpcHostWebSockets;
}
