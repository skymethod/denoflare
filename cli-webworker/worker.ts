/// <reference lib="deno.worker" />

import { consoleLog } from '../common/console.ts';
import { RpcChannel } from '../common/rpc_channel.ts';
import { addRequestHandlerForRunScript } from '../common/rpc_script.ts';

(function() {
    consoleLog('worker: start');
    
    const rpcChannel = new RpcChannel('worker', self.postMessage.bind(self));
    self.onmessage = async function(event) {
        if (await rpcChannel.receiveMessage(event.data)) return;
        consoleLog('worker: onmessage', event.data);
    };
    self.onmessageerror = function(event) {
        consoleLog('worker: onmessageerror', event);
    };
    
    addRequestHandlerForRunScript(rpcChannel);

})();
