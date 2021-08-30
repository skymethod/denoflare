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
import { DenoflareResponse } from './denoflare_response.ts';
import { packResponse } from './rpc_fetch.ts';
import { makeIncomingRequestCfProperties } from './incoming_request_cf_properties.ts';
import { LocalDurableObjects } from './local_durable_objects.ts';
import { UnimplementedDurableObjectNamespace } from './unimplemented_cloudflare_stubs.ts';

export function addRequestHandlerForRunScript(channel: RpcChannel) {
    channel.addRequestHandler('run-script', async requestData => {
        const scriptDef = requestData as ScriptDef;
        const b = new Blob([ scriptDef.scriptContents ]);
        const u = URL.createObjectURL(b);

        let objects: LocalDurableObjects | undefined; 
        const exec = await WorkerExecution.start(u, scriptDef.scriptType, scriptDef.bindings, {
            onModuleWorkerInfo: moduleWorkerInfo => { 
                const { moduleWorkerExportedFunctions, moduleWorkerEnv } = moduleWorkerInfo;
                objects = new LocalDurableObjects(moduleWorkerExportedFunctions, moduleWorkerEnv);
            },
            globalCachesProvider: () => new NoopCfGlobalCaches(),
            kvNamespaceProvider: kvNamespace => new RpcKVNamespace(kvNamespace, channel),
            doNamespaceProvider: doNamespace => {
                // console.log(`doNamespaceProvider`, doNamespace, objects);
                if (objects === undefined) return new UnimplementedDurableObjectNamespace(doNamespace);
                return objects.resolveDoNamespace(doNamespace);
            },
            incomingRequestCfPropertiesProvider: () => makeIncomingRequestCfProperties(),
        });

        const bodies = new Bodies();
        // deno-lint-ignore no-explicit-any
        (globalThis as any).fetch = makeFetchOverRpc(channel, bodies);
        addRequestHandlerForReadBodyChunk(channel, bodies);
        channel.addRequestHandler('worker-fetch', async workerFetchData => {
            const workerFetch = workerFetchData as WorkerFetch;
            const request = unpackRequest(workerFetch.packedRequest, makeBodyResolverOverRpc(channel));

            let response = await exec.fetch(request, workerFetch.opts);

            if (DenoflareResponse.is(response)) {
                response = response.toRealResponse();
            }
            const responseData = await packResponse(response, bodies);
            return responseData;
        });
    });
}

export async function runScript(script: ScriptDef, channel: RpcChannel) {
    await channel.sendRequest('run-script', script, _responseData => {
        return {};
    }, [ ]);
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
}
