import { Binding } from './config.ts';
import { RpcChannel } from './rpc_channel.ts';
import { RpcKVNamespace } from './rpc_kv_namespace.ts';
import { NoopCfGlobalCaches } from './noop_cf_global_caches.ts';
import { WorkerExecution } from './worker_execution.ts';
import { Bodies } from './rpc_fetch.ts';
import { makeFetchOverRpc } from './rpc_fetch.ts';
import { addRequestHandlerForReadBodyChunk } from './rpc_fetch.ts';
import { unpackRequest } from './rpc_fetch.ts';
import { makeBodyResolverOverRpc } from './rpc_fetch.ts';
import { PackedRequest } from './rpc_fetch.ts';
import { packResponse } from './rpc_fetch.ts';
import { makeIncomingRequestCfProperties } from './incoming_request_cf_properties.ts';
import { LocalDurableObjects } from './local_durable_objects.ts';
import { UnimplementedDurableObjectNamespace } from './unimplemented_cloudflare_stubs.ts';
import { ModuleWorkerExecution } from './module_worker_execution.ts';
import { FetchUtil } from './fetch_util.ts';
import { LocalWebSockets } from './local_web_sockets.ts';
import { RpcStubWebSockets } from './rpc_stub_web_sockets.ts';
import { makeRpcStubDurableObjectStorageProvider } from './rpc_stub_durable_object_storage.ts';
import { RpcR2Bucket } from './rpc_r2_bucket.ts';

export function addRequestHandlerForRunScript(channel: RpcChannel) {
    channel.addRequestHandler('run-script', async requestData => {
        const { verbose, scriptContents, scriptType, bindings } = requestData as ScriptDef;
        if (verbose) {
            // in common
            RpcChannel.VERBOSE = verbose;
            ModuleWorkerExecution.VERBOSE = verbose;
            FetchUtil.VERBOSE = verbose;
            LocalWebSockets.VERBOSE = verbose;
        }
        const b = new Blob([ scriptContents ]);
        const u = URL.createObjectURL(b);

        let objects: LocalDurableObjects | undefined; 
        const rpcStubWebSockets = new RpcStubWebSockets(channel);
        const rpcDurableObjectStorageProvider = makeRpcStubDurableObjectStorageProvider(channel);

        // redefine fetch
        // must be done before running the script, as the script might do fetches in top-level await (e.g. importWasm)
        const bodies = new Bodies();
        // deno-lint-ignore no-explicit-any
        (globalThis as any).fetch = makeFetchOverRpc(channel, bodies, v => rpcStubWebSockets.unpackWebSocket(v));
        addRequestHandlerForReadBodyChunk(channel, bodies);
        channel.addRequestHandler('worker-fetch', async workerFetchData => {
            const workerFetch = workerFetchData as WorkerFetch;
            const request = unpackRequest(workerFetch.packedRequest, makeBodyResolverOverRpc(channel));

            const response = await exec.fetch(request, workerFetch.opts);
            const responseData = await packResponse(response, bodies, v => rpcStubWebSockets.packWebSocket(v));
            return { data: responseData, transfer: responseData.bodyBytes ? [ responseData.bodyBytes.buffer ] : [] };
        });

        const exec = await WorkerExecution.start(u, scriptType, bindings, {
            onModuleWorkerInfo: moduleWorkerInfo => { 
                const { moduleWorkerExportedFunctions, moduleWorkerEnv } = moduleWorkerInfo;
                const storageProvider = rpcDurableObjectStorageProvider;
                objects = new LocalDurableObjects({ moduleWorkerExportedFunctions, moduleWorkerEnv, storageProvider });
            },
            globalCachesProvider: () => new NoopCfGlobalCaches(),
            webSocketPairProvider: () => rpcStubWebSockets.allocateNewWebSocketPair(),
            kvNamespaceProvider: kvNamespace => new RpcKVNamespace(kvNamespace, channel),
            doNamespaceProvider: doNamespace => {
                // console.log(`doNamespaceProvider`, doNamespace, objects);
                if (objects === undefined) return new UnimplementedDurableObjectNamespace(doNamespace);
                return objects.resolveDoNamespace(doNamespace)
            },
            r2BucketProvider: bucketName => new RpcR2Bucket(bucketName, channel, makeBodyResolverOverRpc(channel), bodies),
            incomingRequestCfPropertiesProvider: () => makeIncomingRequestCfProperties(),
        });
    });
}

export async function runScript(script: ScriptDef, channel: RpcChannel) {
    const { verbose } = script;
    const start = Date.now();
    const len = script.scriptContents.length;
    await channel.sendRequest('run-script', script, _responseData => {
        return {};
    }, [ script.scriptContents.buffer ]);
    if (verbose) console.log(`runScript scriptContents.length=${len} took ${Date.now() - start}ms`);
}

//

export interface WorkerFetch {
    readonly packedRequest: PackedRequest;
    readonly opts: { cfConnectingIp: string, hostname?: string };
}

export interface ScriptDef {
    readonly scriptType: 'module' | 'script';
    readonly scriptContents: Uint8Array;
    readonly bindings: Record<string, Binding>;
    readonly verbose: boolean;
}
