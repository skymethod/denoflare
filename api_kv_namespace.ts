import { KVGetOptions, KVListCompleteResult, KVListIncompleteResult, KVListOptions, KVNamespace, KVPutOptions, KVValueAndMetadata } from './deps_cf.ts';
import { getKeyMetadata, getKeyValue } from './cloudflare_api.ts';

export class ApiKVNamespace implements KVNamespace {

    get(key: string, opts: { type: 'text' }): Promise<string|null>;
    get(key: string, opts: { type: 'json' }): Promise<Record<string,unknown>|null>;
    get(key: string, opts: { type: 'arrayBuffer' }): Promise<ArrayBuffer|null>;
    // deno-lint-ignore no-explicit-any
    get(key: string, opts: { type: 'stream' }): Promise<ReadableStream<any>|null>;
    // deno-lint-ignore no-explicit-any
    async get(key: any, opts: any): Promise<any> {
        const bytes = await getKeyValue(this.accountId, this.namespaceId, key, this.apiToken);
        if (bytes === undefined) return null;
        if (opts.type === 'arrayBuffer') {
            return bytes.buffer;
        }
        throw new Error(`ApiKVNamespace.get not implemented. key=${typeof key} ${key}, opts=${JSON.stringify(opts)}`);
    } 

    getWithMetadata(key: string, opts: KVGetOptions | { type: 'text' }): Promise<KVValueAndMetadata<string> | null>;
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'json' }): Promise<KVValueAndMetadata<Record<string, unknown>> | null>;
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'arrayBuffer' }): Promise<KVValueAndMetadata<ArrayBuffer> | null>;
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'stream' }): Promise<KVValueAndMetadata<ReadableStream> | null>;
    // deno-lint-ignore no-explicit-any
    async getWithMetadata(key: string, opts: any): Promise<any> {
        const bytes = await getKeyValue(this.accountId, this.namespaceId, key, this.apiToken);
        if (bytes === undefined) return null;
        const metadata = await getKeyMetadata(this.accountId, this.namespaceId, key, this.apiToken);
        if (opts.type === 'arrayBuffer') {
            const rt: KVValueAndMetadata<ArrayBuffer> = { value: bytes.buffer, metadata };
            return rt;
        }
        throw new Error(`ApiKVNamespace.getWithMetadata not implemented. key=${key} opts=${JSON.stringify(opts)}`);
    } 
    
    put(_key: string, _value: string | ReadableStream | ArrayBuffer, _opts?: KVPutOptions): Promise<void> {
        throw new Error(`ApiKVNamespace.put not implemented.`);
    }

    delete(_key: string): Promise<void> {
        throw new Error(`ApiKVNamespace.delete not implemented.`);
    }

    list(_opts?: KVListOptions): Promise<KVListCompleteResult | KVListIncompleteResult> {
        throw new Error(`ApiKVNamespace.list not implemented.`);
    }

    readonly accountId: string;
    readonly apiToken: string;
    readonly namespaceId: string;

    constructor(accountId: string, apiToken: string, namespaceId: string) {
        this.accountId = accountId;
        this.apiToken = apiToken;
        this.namespaceId = namespaceId;
    }
    
}
