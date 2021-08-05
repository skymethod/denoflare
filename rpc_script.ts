import { Binding } from './config.ts';
import { RpcChannel } from './rpc_channel.ts';
import { DurableObjectNamespace, DurableObjectId, DurableObjectStub } from 'https://github.com/skymethod/cloudflare-workers-types/raw/ab2ff7fd2ce19f35efdf0ab0fdcf857404ab0c17/cloudflare_workers_types.d.ts';
import { RpcKVNamespace } from './rpc_kv_namespace.ts';
import { defineGlobals } from './cloudflare_workers_runtime.ts';

export function addRequestHandlerForRunScript(channel: RpcChannel, onSuccess: () => void) {
    channel.addRequestHandler('run-script', async requestData => {
        try {
            const start = Date.now();
            const scriptDef = requestData as ScriptDef;
            defineGlobals(scriptDef.bindings, kvNamespace => new RpcKVNamespace(kvNamespace, channel), doNamespace => new DurableObjectNamespaceRpcClient(doNamespace));
            const b = new Blob([ scriptDef.scriptContents ]);
            const u = URL.createObjectURL(b);
            await import(u);
            console.log(`worker: Ran script in ${Date.now() - start}ms`);
            onSuccess();
        } catch (e) {
            console.error('worker: Error in run-script', e);
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
