import { ApiKVNamespace } from './api_kv_namespace.ts';
import { Profile, Binding, isR2BucketBinding } from '../common/config.ts';
import { consoleError, consoleLog } from '../common/console.ts';
import { RpcChannel } from '../common/rpc_channel.ts';
import { Bodies, PackedRequest, packResponse, addRequestHandlerForReadBodyChunk, packRequest, unpackResponse, makeBodyResolverOverRpc, unpackRequest } from '../common/rpc_fetch.ts';
import { addRequestHandlerForRpcKvNamespace } from '../common/rpc_kv_namespace.ts';
import { runScript, WorkerFetch } from '../common/rpc_script.ts';
import { dirname, fromFileUrl, resolve } from './deps_cli.ts';
import { DenoflareResponse } from '../common/denoflare_response.ts';
import { RpcHostWebSockets } from './rpc_host_web_sockets.ts';
import { makeRpcHostDurableObjectStorage } from './rpc_host_durable_object_storage.ts';
import { bundle, BundleOpts } from './bundle.ts';
import { addRequestHandlerForRpcR2Bucket } from '../common/rpc_r2_bucket.ts';
import { R2BucketProvider } from '../common/cloudflare_workers_runtime.ts';
import { ApiR2Bucket } from './api_r2_bucket.ts';
import { CLI_USER_AGENT } from './cli_common.ts';
import { versionCompare } from './versions.ts';
import { InMemoryR2Bucket } from './in_memory_r2_bucket.ts';
import { RpcHostSockets } from './rpc_host_sockets.ts';

export class WorkerManager {
    static VERBOSE = false;

    private readonly workerUrl: string;
    private readonly denoVersion = Deno.version.deno;

    private currentWorker?: WorkerInfo;

    private constructor(workerUrl: string) {
        this.workerUrl = workerUrl;
    }

    static async start(opts: BundleOpts | undefined): Promise<WorkerManager> {
        // compile the permissionless deno worker (once)
        const webworkerRootSpecifier = computeWebworkerRootSpecifier();
        consoleLog(`Compiling ${webworkerRootSpecifier} into worker contents...`);
        const start = Date.now();
        const newOpts: BundleOpts = { ...opts };
        if (newOpts.compilerOptions) throw new Error(`Compiler options are not settable here`);
        newOpts.compilerOptions = { lib: [ 'deno.worker' ] };
        let { code: workerJs, backend } = await bundle(webworkerRootSpecifier, newOpts);
        if (!canWorkerOptionsRemoveDenoNamespace()) {
            workerJs = 'delete globalThis.Deno;\n' + workerJs;
        }
        if (WorkerManager.VERBOSE) consoleLog(workerJs);
        const contents = new TextEncoder().encode(workerJs);
        const blob = new Blob([contents]);
        const workerUrl = URL.createObjectURL(blob);
        consoleLog(`Bundled ${webworkerRootSpecifier} (${backend}) in ${Date.now() - start}ms`);
        return new WorkerManager(workerUrl);
    }

    async run(scriptContents: Uint8Array, scriptType: 'module' | 'script', opts: { bindings: Record<string, Binding>, profile: Profile | undefined }): Promise<void> {
        const { bindings, profile } = opts;
        const { denoVersion } = this;

        if (this.currentWorker) {
            this.currentWorker.worker.terminate();
            this.currentWorker = undefined;
        }

        // instantiate the permissionless deno worker
        const workerOptions: WorkerOptions = { deno: { permissions: 'none' }, type: 'module' };
        if (canWorkerOptionsRemoveDenoNamespace()) {
            // deno-lint-ignore no-explicit-any
            (workerOptions.deno as any).namespace = false;
        }
        const worker = new Worker(this.workerUrl, workerOptions);

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
        // host side of the rpc socket impl
        const _rpcHostSockets = new RpcHostSockets(rpcChannel);

        // make external fetch calls on behalf of the worker
        const bodies = new Bodies();
        const requestBodyResolver = makeBodyResolverOverRpc(rpcChannel, denoVersion);
        rpcChannel.addRequestHandler('fetch', async requestData => {
            const req = unpackRequest(requestData as PackedRequest, requestBodyResolver);
            const res = await fetch(req);
            let overrideContentType: string | undefined;
            if (req.url.startsWith('file://')) {
                const importType = new URL(req.url).searchParams.get('import');
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

        // handle rpc r2 requests, forward to cloudflare api
        const r2BucketProvider = await computeR2BucketProvider(profile, bindings, CLI_USER_AGENT);
        addRequestHandlerForRpcR2Bucket(rpcChannel, bodies, requestBodyResolver, r2BucketProvider);

        // run the script in the deno worker
        await runScript({ scriptContents, scriptType, bindings, verbose: WorkerManager.VERBOSE, denoVersion }, rpcChannel);

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
            return unpackResponse(responseData, makeBodyResolverOverRpc(rpcChannel, this.denoVersion), v => rpcHostWebSockets.unpackWebSocket(v));
        });
        return res;
    }

}

export async function computeR2BucketProvider(profile: Profile | undefined, bindings: Record<string, Binding>, userAgent: string): Promise<R2BucketProvider> {
    if (Object.values(bindings).some(isR2BucketBinding)) {
        const { accountId, credentials } = await ApiR2Bucket.parseAccountAndCredentials(profile);
        const inMemoryBuckets = new Map<string, InMemoryR2Bucket>();
        return bucketName => {
            // in-memory bucket?
            const m = /^local:memory:([a-zA-Z0-9-]+)$/.exec(bucketName);
            if (m) {
                const [ _, name ] = m;
                // share in-memory-buckets by name (trailing parameter)
                let bucket = inMemoryBuckets.get(name);
                if (!bucket) {
                    bucket = new InMemoryR2Bucket(name);
                    inMemoryBuckets.set(name, bucket);
                }
                return bucket;
            }

            // api bucket
            return ApiR2Bucket.ofAccountAndCredentials(accountId, credentials, bucketName, userAgent);
        }
    }
    return _ => { throw new Error('computeR2BucketProvider: No R2 bucket bindings found'); }
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

function canWorkerOptionsRemoveDenoNamespace() {
    return versionCompare(Deno.version.deno, '1.22') < 0;
}

//

interface WorkerInfo {
    readonly rpcChannel: RpcChannel;
    readonly bodies: Bodies;
    readonly worker: Worker;
    readonly rpcHostWebSockets: RpcHostWebSockets;
}
