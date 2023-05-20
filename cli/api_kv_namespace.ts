import { KVGetOptions, KVListCompleteResult, KVListIncompleteResult, KVListOptions, KVNamespace, KVPutOptions, KVValueAndMetadata } from '../common/cloudflare_workers_types.d.ts';
import { deleteKeyValue, getKeyMetadata, getKeyValue, listKeys, putKeyValue } from '../common/cloudflare_api.ts';
import { Profile } from '../common/config.ts';
import { Bytes } from '../common/bytes.ts';

export class ApiKVNamespace implements KVNamespace {

    readonly accountId: string;
    readonly apiToken: string;
    readonly namespaceId: string;

    constructor(accountId: string, apiToken: string, namespaceId: string) {
        this.accountId = accountId;
        this.apiToken = apiToken;
        this.namespaceId = namespaceId;
    }

    static ofProfile(profile: Profile | undefined, kvNamespace: string) {
        if (!profile) throw new Error('Cannot use a kvNamespace binding without configuring a profile to use for its credentials');
        const { accountId, apiToken } = profile;
        return new ApiKVNamespace(accountId, apiToken, kvNamespace);
    }
    
    get(key: string, opts?: { type: 'text' }): Promise<string|null>;
    get(key: string, opts: { type: 'json' }): Promise<Record<string,unknown>|null>;
    get(key: string, opts: { type: 'arrayBuffer' }): Promise<ArrayBuffer|null>;
    // deno-lint-ignore no-explicit-any
    get(key: string, opts: { type: 'stream' }): Promise<ReadableStream<any>|null>;
    // deno-lint-ignore no-explicit-any
    async get(key: any, opts: any = { type: 'text' }): Promise<any> {
        const { accountId, namespaceId, apiToken } = this;
        const bytes = await getKeyValue({ accountId, namespaceId, key, apiToken });
        if (bytes === undefined) return null;
        if (opts && opts.type === 'arrayBuffer') {
            return bytes.buffer;
        } else if (opts && opts.type === 'json') {
            return JSON.parse(new Bytes(bytes).utf8());
        } else if (opts && opts.type === 'text') {
            return new Bytes(bytes).utf8();
        }
        throw new Error(`ApiKVNamespace.get not implemented. key=${typeof key} ${key}, opts=${JSON.stringify(opts)}`);
    } 

    getWithMetadata(key: string, opts?: KVGetOptions | { type: 'text' }): Promise<KVValueAndMetadata<string> | null>;
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'json' }): Promise<KVValueAndMetadata<Record<string, unknown>> | null>;
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'arrayBuffer' }): Promise<KVValueAndMetadata<ArrayBuffer> | null>;
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'stream' }): Promise<KVValueAndMetadata<ReadableStream> | null>;
    // deno-lint-ignore no-explicit-any
    async getWithMetadata(key: string, opts: any): Promise<any> {
        const { accountId, namespaceId, apiToken } = this;
        const bytes = await getKeyValue({ accountId, namespaceId, key, apiToken });
        if (bytes === undefined) return null;
        const metadata = await getKeyMetadata(this.accountId, this.namespaceId, key, this.apiToken);
        if (opts && opts.type === 'arrayBuffer') {
            const rt: KVValueAndMetadata<ArrayBuffer> = { value: bytes.buffer, metadata: metadata || null };
            return rt;
        }
        if (opts && opts.type === 'json') {
            const value = JSON.parse(new Bytes(bytes).utf8());
            const rt: KVValueAndMetadata<Record<string, unknown>> = { value, metadata: metadata || null };
            return rt;
        }
        throw new Error(`ApiKVNamespace.getWithMetadata not implemented. key=${key} opts=${JSON.stringify(opts)}`);
    } 
    
    async put(key: string, value: string | ReadableStream | ArrayBuffer, opts?: KVPutOptions): Promise<void> {
        const { accountId, namespaceId, apiToken } = this;
    
        const operation = { accountId, namespaceId, key, apiToken, ...opts };
    
        if (typeof value === "string") {
          return await putKeyValue({ ...operation, value });
        } else if ("pipeTo" in value) {
          let chunks = "";
          const stream = value.pipeThrough(new TextDecoderStream());

          for await (const chunk of stream) {
            chunks += chunk;
          }
    
          return await putKeyValue({ ...operation, value: chunks });
        } else if ("slice" in value) {
          return await putKeyValue({ ...operation, value: new TextDecoder().decode(value) });
        }
    
        throw new Error(`ApiKVNamespace.put not implemented. key=${key} value=${value} opts=${JSON.stringify(opts)}`);
    }
    
    async delete(key: string): Promise<void> {
        const { accountId, namespaceId, apiToken } = this;

        await deleteKeyValue({ accountId, namespaceId, apiToken, key });
    }

    list(opts?: KVListOptions): Promise<KVListCompleteResult | KVListIncompleteResult> {
        const { accountId, namespaceId, apiToken } = this;

        return listKeys({ accountId, namespaceId, apiToken, ...opts });
    }
}
