// /// <reference lib="deno.worker" />

import { dispatchFetchEvent } from './cloudflare_workers_runtime.ts';
import { consoleLog } from './console.ts';
import { DenoflareResponse } from './denoflare_response.ts';
import { Data, RpcChannel } from './rpc_channel.ts';
import { addRequestHandlerForReadBodyChunk, Bodies, makeBodyResolverOverRpc, makeFetchOverRpc, packResponse, unpackRequest } from './rpc_fetch.ts';
import { addRequestHandlerForRunScript } from './rpc_script.ts';
import { SubtleCryptoPolyfill } from './subtle_crypto_polyfill.ts';

(function() {
    consoleLog('worker: start');
    
    SubtleCryptoPolyfill.applyIfNecessary();
    
    interface SmallDedicatedWorkerGlobalScope {
        onmessage: ((this: SmallDedicatedWorkerGlobalScope, ev: MessageEvent) => Data) | null;
        onmessageerror: ((this: SmallDedicatedWorkerGlobalScope, ev: MessageEvent) => Data) | null;
        close(): void;
        postMessage(message: Data): void;
    }
    
    // deno-lint-ignore no-explicit-any
    const globalThisAny = globalThis as any;
    const selfWorker = globalThisAny as SmallDedicatedWorkerGlobalScope;
    const rpcChannel = new RpcChannel('worker', selfWorker.postMessage.bind(selfWorker));
    selfWorker.onmessage = function(event) {
        if (rpcChannel.receiveMessage(event.data)) return;
        consoleLog('worker: onmessage', event.data);
    };
    selfWorker.onmessageerror = function(event) {
        consoleLog('worker: onmessageerror', event);
    };
    const bodies = new Bodies();
    globalThisAny.fetch = makeFetchOverRpc(rpcChannel, bodies);
    
    let fetchListener: EventListener | undefined;
    
    const addEventListener = (type: string, listener: EventListener) => {
        consoleLog(`worker: addEventListener type=${type}`);
        if (type === 'fetch') {
            fetchListener = listener;
        }
    }
    
    const afterScript = () => {
        consoleLog(`worker: afterScript fetchListener=${!!fetchListener}`);

        if (fetchListener !== undefined) {
            const fetchListenerF = fetchListener;
            addRequestHandlerForReadBodyChunk(rpcChannel, bodies);
            rpcChannel.addRequestHandler('fetch', async requestData => {
                const request = unpackRequest(requestData, makeBodyResolverOverRpc(rpcChannel));
                let response = await dispatchFetchEvent(request, { colo: 'DNO' }, fetchListenerF);
                if (DenoflareResponse.is(response)) {
                    response = response.toRealResponse();
                }
                const responseData = await packResponse(response, bodies);
                return responseData;
            });
        }
    }

    addRequestHandlerForRunScript(rpcChannel, () => {
        afterScript();
    });

    // deno-lint-ignore no-explicit-any
    (self as any).addEventListener = addEventListener;

})();
