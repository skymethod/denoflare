import { Binding, isDONamespaceBinding, isKVNamespaceBinding, isSecretBinding, isTextBinding } from './config.ts';
import { RpcChannel } from './rpc_channel.ts';
import { KVNamespace, DurableObjectNamespace, KVGetOptions, KVValueAndMetadata, KVPutOptions, KVListCompleteResult, KVListIncompleteResult, KVListOptions, DurableObjectId, DurableObjectStub } from 'https://github.com/skymethod/cloudflare-workers-types/raw/ab2ff7fd2ce19f35efdf0ab0fdcf857404ab0c17/cloudflare_workers_types.d.ts';

export function addRequestHandlerForRunScript(channel: RpcChannel, onSuccess: () => void) {
    channel.addRequestHandler('run-script', async requestData => {
        try {
            const start = Date.now();
            const scriptDef = requestData as ScriptDef;
            // deno-lint-ignore no-explicit-any
            const globalThisAny = globalThis as any;
            for (const [ name, binding ] of Object.entries(scriptDef.bindings)) {
                globalThisAny[name] = computeBindingValue(binding);
            }
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

function computeBindingValue(binding: Binding): string | KVNamespace | DurableObjectNamespace {
    if (isTextBinding(binding)) return binding.value;
    if (isSecretBinding(binding)) return binding.secret;
    if (isKVNamespaceBinding(binding)) return createKVNamespaceStub(binding.kvNamespace);
    if (isDONamespaceBinding(binding)) return createDONamespaceStub(binding.doNamespace);
    throw new Error(`TODO implement binding ${JSON.stringify(binding)}`);

}

function createKVNamespaceStub(kvNamespace: string): KVNamespace {
    return new KVNamespaceRpcClient(kvNamespace);
}

function createDONamespaceStub(doNamespace: string): DurableObjectNamespace {
    return new DurableObjectNamespaceRpcClient(doNamespace);
}

//

interface ScriptDef {
    readonly scriptContents: Uint8Array;
    readonly bindings: Record<string, Binding>;
}

class KVNamespaceRpcClient implements KVNamespace {
    get(key: string, opts: { type: 'text' }): Promise<string|null>;
    get(key: string, opts: { type: 'json' }): Promise<Record<string,unknown>|null>;
    get(key: string, opts: { type: 'arrayBuffer' }): Promise<ArrayBuffer|null>;
    // deno-lint-ignore no-explicit-any
    get(key: string,opts: { type: 'stream' }): Promise<ReadableStream<any>|null>;
    // deno-lint-ignore no-explicit-any
    get(_key: any, _opts: any): Promise<any> {
        throw new Error(`KVNamespaceRpcStub.get not implemented.`);
    } 

    getWithMetadata(key: string, opts: KVGetOptions | { type: 'text' }): Promise<KVValueAndMetadata<string> | null>;
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'json' }): Promise<KVValueAndMetadata<Record<string, unknown>> | null>;
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'arrayBuffer' }): Promise<KVValueAndMetadata<ArrayBuffer> | null>;
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'stream' }): Promise<KVValueAndMetadata<ReadableStream> | null>;
    // deno-lint-ignore no-explicit-any
    getWithMetadata(_key: any, _opts: any): Promise<any> {
        throw new Error(`KVNamespaceRpcStub.getWithMetadata not implemented.`);
    } 
    
    put(_key: string, _value: string | ReadableStream | ArrayBuffer, _opts?: KVPutOptions): Promise<void> {
        throw new Error(`KVNamespaceRpcStub.put not implemented.`);
    }

    delete(_key: string): Promise<void> {
        throw new Error(`KVNamespaceRpcStub.delete not implemented.`);
    }

    list(_opts?: KVListOptions): Promise<KVListCompleteResult | KVListIncompleteResult> {
        throw new Error(`KVNamespaceRpcStub.list not implemented.`);
    }

    readonly kvNamespace: string;

    constructor(kvNamespace: string) {
        this.kvNamespace = kvNamespace;
    }

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
