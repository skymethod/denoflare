import { Binding } from './config.ts';
import { RpcChannel } from './rpc_channel.ts';
import { DurableObjectNamespace, DurableObjectId, DurableObjectStub } from './deps_cf.ts';
import { RpcKVNamespace } from './rpc_kv_namespace.ts';
import { defineScriptGlobals } from './cloudflare_workers_runtime.ts';
import { consoleError, consoleLog } from './console.ts';

export function addRequestHandlerForRunScript(channel: RpcChannel, onSuccess: () => void) {
    channel.addRequestHandler('run-script', async requestData => {
        try {
            const start = Date.now();
            const scriptDef = requestData as ScriptDef;
            defineScriptGlobals(scriptDef.bindings, kvNamespace => new RpcKVNamespace(kvNamespace, channel), doNamespace => new DurableObjectNamespaceRpcClient(doNamespace));
            const b = new Blob([ scriptDef.scriptContents ]);
            const u = URL.createObjectURL(b);
            await import(u);
            consoleLog(`worker: Ran script in ${Date.now() - start}ms`);
            onSuccess();
        } catch (e) {
            consoleError('worker: Error in run-script', e);
        }
    });
}

export async function runScript(script: ScriptDef, channel: RpcChannel) {
    await channel.sendRequest('run-script', script, _responseData => {
        return {};
    }, [ ]);
}

//

interface ScriptDef {
    readonly scriptContents: Uint8Array;
    readonly bindings: Record<string, Binding>;
}

class DurableObjectNamespaceRpcClient implements DurableObjectNamespace {
    readonly doNamespace: string;

    constructor(doNamespace: string) {
        this.doNamespace = doNamespace;
    }

    newUniqueId(_opts?: { jurisdiction: 'eu' }): DurableObjectId {
        throw new Error(`DurableObjectNamespaceRpcStub.newUniqueId not implemented.`);
    }

    idFromName(_name: string): DurableObjectId {
        throw new Error(`DurableObjectNamespaceRpcStub.idFromName not implemented.`);
    }

    idFromString(_hexStr: string): DurableObjectId {
        throw new Error(`DurableObjectNamespaceRpcStub.idFromString not implemented.`);
    }

    get(_id: DurableObjectId): DurableObjectStub {
        throw new Error(`DurableObjectNamespaceRpcStub.get not implemented.`);
    }

}
