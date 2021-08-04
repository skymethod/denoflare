import { Binding, isDONamespaceBinding, isKVNamespaceBinding, isSecretBinding, isTextBinding } from './config.ts';
import { RpcChannel } from './rpc_channel.ts';
import { KVNamespace, DurableObjectNamespace, DurableObjectId, DurableObjectStub, CfCache, CfCacheOptions, CfGlobalCaches } from 'https://github.com/skymethod/cloudflare-workers-types/raw/ab2ff7fd2ce19f35efdf0ab0fdcf857404ab0c17/cloudflare_workers_types.d.ts';
import { RpcKVNamespace } from './rpc_kv_namespace.ts';

export function addRequestHandlerForRunScript(channel: RpcChannel, onSuccess: () => void) {
    channel.addRequestHandler('run-script', async requestData => {
        try {
            const start = Date.now();
            const scriptDef = requestData as ScriptDef;
            // deno-lint-ignore no-explicit-any
            const globalThisAny = globalThis as any;
            for (const [ name, binding ] of Object.entries(scriptDef.bindings)) {
                globalThisAny[name] = computeBindingValue(binding, channel);
            }
            const caches: CfGlobalCaches = { default: new NoopCfCache() };
            globalThisAny['caches'] = caches;
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

function computeBindingValue(binding: Binding, channel: RpcChannel): string | KVNamespace | DurableObjectNamespace {
    if (isTextBinding(binding)) return binding.value;
    if (isSecretBinding(binding)) return binding.secret;
    if (isKVNamespaceBinding(binding)) return new RpcKVNamespace(binding.kvNamespace, channel);
    if (isDONamespaceBinding(binding)) return createDONamespaceStub(binding.doNamespace);
    throw new Error(`TODO implement binding ${JSON.stringify(binding)}`);

}

function createDONamespaceStub(doNamespace: string): DurableObjectNamespace {
    return new DurableObjectNamespaceRpcClient(doNamespace);
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

class NoopCfCache implements CfCache {

    put(_request: string | Request, _response: Response): Promise<undefined> {
        return Promise.resolve(undefined);
    }
    
    match(_request: string | Request, _options?: CfCacheOptions): Promise<Response|undefined> {
        return Promise.resolve(undefined);
    }

    delete(_request: string | Request, _options?: CfCacheOptions): Promise<boolean> {
        return Promise.resolve(false);
    }

}
