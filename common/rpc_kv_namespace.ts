import { KVGetOptions, KVListCompleteResult, KVListIncompleteResult, KVListOptions, KVNamespace, KVValueAndMetadata, KVPutOptions } from './cloudflare_workers_types.d.ts';
import { RpcChannel } from './rpc_channel.ts';

export function addRequestHandlerForRpcKvNamespace(channel: RpcChannel, kvNamespaceResolver: (kvNamespace: string) => KVNamespace) {
    channel.addRequestHandler('kv-namespace-get', async requestData => {
        const req = requestData as KVNamespaceGetArrayBufferRequest;
        if (req.type === 'arrayBuffer') {
            const { cacheTtl, kvNamespace, key } = req;
            const target = kvNamespaceResolver(kvNamespace);
            const buffer = await target.get(key, { type: 'arrayBuffer', cacheTtl });
            const res: KVNamespaceGetArrayBufferResponse = { type: req.type, buffer };
            return res;
        }
        throw new Error(`RequestHandlerForRpcKvNamespace: Implement ${req.type}, req=${JSON.stringify(req)}`);
    });
}

export class RpcKVNamespace implements KVNamespace {
    get(key: string, opts: { type: 'text' }): Promise<string|null>;
    get(key: string, opts: { type: 'json' }): Promise<Record<string,unknown>|null>;
    get(key: string, opts: { type: 'arrayBuffer' }): Promise<ArrayBuffer|null>;
    // deno-lint-ignore no-explicit-any
    get(key: string, opts: { type: 'stream' }): Promise<ReadableStream<any>|null>;
    // deno-lint-ignore no-explicit-any
    async get(key: any, opts: any): Promise<any> {
        if (typeof key === 'string') {
            if (opts.type === 'arrayBuffer' || opts === 'arrayBuffer') {
                const { kvNamespace } = this;
                const req: KVNamespaceGetArrayBufferRequest = { type: 'arrayBuffer', key, kvNamespace };
                return await this.channel.sendRequest('kv-namespace-get', req, responseData => {
                    const res = responseData as KVNamespaceGetResponse;
                    if (res.type === 'arrayBuffer') return res.buffer;
                    throw new Error(`Bad res.type ${res.type}, expected arrayBuffer`);
                });
            }
        }
        throw new Error(`RpcKVNamespace.get not implemented. key=${typeof key} ${key}, opts=${JSON.stringify(opts)}`);
    } 

    getWithMetadata(key: string, opts: KVGetOptions | { type: 'text' }): Promise<KVValueAndMetadata<string> | null>;
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'json' }): Promise<KVValueAndMetadata<Record<string, unknown>> | null>;
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'arrayBuffer' }): Promise<KVValueAndMetadata<ArrayBuffer> | null>;
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'stream' }): Promise<KVValueAndMetadata<ReadableStream> | null>;
    // deno-lint-ignore no-explicit-any
    getWithMetadata(_key: any, _opts: any): Promise<any> {
        throw new Error(`RpcKVNamespace.getWithMetadata not implemented.`);
    } 
    
    put(_key: string, _value: string | ReadableStream | ArrayBuffer, _opts?: KVPutOptions): Promise<void> {
        throw new Error(`RpcKVNamespace.put not implemented.`);
    }

    delete(_key: string): Promise<void> {
        throw new Error(`RpcKVNamespace.delete not implemented.`);
    }

    list(_opts?: KVListOptions): Promise<KVListCompleteResult | KVListIncompleteResult> {
        throw new Error(`KVNamespaceRpcStub.list not implemented.`);
    }

    readonly kvNamespace: string;
    readonly channel: RpcChannel;

    constructor(kvNamespace: string, channel: RpcChannel) {
        this.kvNamespace = kvNamespace;
        this.channel = channel;
    }

}

//

type KVNamespaceGetRequest = KVNamespaceGetArrayBufferRequest;

interface KVNamespaceGetArrayBufferRequest {
    readonly kvNamespace: string;
    readonly type: 'arrayBuffer';
    readonly key: string;
    readonly cacheTtl?: number;
}

type KVNamespaceGetResponse = KVNamespaceGetArrayBufferResponse;

interface KVNamespaceGetArrayBufferResponse {
    readonly type: 'arrayBuffer';
    readonly buffer: ArrayBuffer | null;
}
