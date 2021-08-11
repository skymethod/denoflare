// /// <reference lib="deno.worker" />

import { consoleLog } from './console.ts';
import { Data, RpcChannel } from './rpc_channel.ts';
import { addRequestHandlerForRunScript } from './rpc_script.ts';

(function() {
    consoleLog('worker: start');
    
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
    
    addRequestHandlerForRunScript(rpcChannel);

})();
