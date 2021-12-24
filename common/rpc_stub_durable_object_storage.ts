import { DurableObjectId, DurableObjectStorage, DurableObjectStorageListOptions, DurableObjectStorageReadOptions, DurableObjectStorageTransaction, DurableObjectStorageValue, DurableObjectStorageWriteOptions } from './cloudflare_workers_types.d.ts';
import { DurableObjectStorageProvider } from './local_durable_objects.ts';
import { RpcChannel } from './rpc_channel.ts';
import { InMemoryDurableObjectStorage } from './storage/in_memory_durable_object_storage.ts';

export function makeRpcStubDurableObjectStorageProvider(channel: RpcChannel): DurableObjectStorageProvider {
    return (className, id, options) => {
        if ((options.storage || 'memory') === 'memory') return new InMemoryDurableObjectStorage(); // optimization, right now memory impl functions the same in either isolate
        return new RpcStubDurableObjectStorage(channel, { className, id, options });
    }
}

export type DeleteAll = { method: 'delete-all', reference: DurableObjectStorageReference };
export type Get1 = { method: 'get1', reference: DurableObjectStorageReference, key: string, opts?: DurableObjectStorageReadOptions };
export type Put1 = { method: 'put1', reference: DurableObjectStorageReference, key: string, value: DurableObjectStorageValue, opts?: DurableObjectStorageWriteOptions };
export type List = { method: 'list', reference: DurableObjectStorageReference, options: DurableObjectStorageListOptions & DurableObjectStorageReadOptions };
export type Delete1 = { method: 'delete1', reference: DurableObjectStorageReference, key: string, opts?: DurableObjectStorageWriteOptions };

export interface DurableObjectStorageReference {
    readonly className: string;
    readonly id: DurableObjectId;
    readonly options: Record<string, string>;
}

//

class RpcStubDurableObjectStorage implements DurableObjectStorage {
    private readonly channel: RpcChannel;
    private readonly reference: DurableObjectStorageReference;

    constructor(channel: RpcChannel, reference: DurableObjectStorageReference) {
        this.channel = channel;
        this.reference = reference;
    }
    
    async transaction<T>(closure: (txn: DurableObjectStorageTransaction) => T | PromiseLike<T>): Promise<T> {
        const txn = new RpcStubDurableObjectStorageTransaction(this);
        return await Promise.resolve(closure(txn));
    }

    async deleteAll(): Promise<void> {
        const { reference } = this;
        const deleteAll: DeleteAll = { method: 'delete-all', reference };
        return await this.channel.sendRequest('do-storage', deleteAll, data => {
            const { error } = data;
            if (typeof error === 'string') throw new Error(error);
        });
    }

    get(key: string, opts?: DurableObjectStorageReadOptions): Promise<DurableObjectStorageValue | undefined>;
    get(keys: readonly string[], opts?: DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue>>;
    get(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue> | DurableObjectStorageValue | undefined> {
        return this._get(keyOrKeys, opts); 
    }

    async _get(keyOrKeys: string | readonly string[], opts: DurableObjectStorageReadOptions = {}): Promise<Map<string, DurableObjectStorageValue> | DurableObjectStorageValue | undefined> {
        if (typeof keyOrKeys === 'string') {
            const key = keyOrKeys;
            const { reference } = this;
            const get1: Get1 = { method: 'get1', reference, key, opts };
            return await this.channel.sendRequest('do-storage', get1, data => {
                const { error, value } = data;
                if (typeof error === 'string') throw new Error(error);
                return value;
            });
        }
        throw new Error(`RpcStubDurableObjectStorage.get not implemented ${keyOrKeys} ${opts}`);
    }
   
    put(key: string, value: DurableObjectStorageValue, opts?: DurableObjectStorageWriteOptions): Promise<void>;
    put(entries: Record<string, unknown>, opts?: DurableObjectStorageWriteOptions): Promise<void>;
    put(arg1: unknown, arg2?: unknown, arg3?: unknown): Promise<void> {
        return this._put(arg1, arg2, arg3);
    }

    async _put(arg1: unknown, arg2?: unknown, arg3?: unknown): Promise<void> {
        if (typeof arg1 === 'string') {
            const key = arg1;
            const value = arg2 as DurableObjectStorageValue;
            const opts = arg3 as DurableObjectStorageWriteOptions | undefined;
            const { reference } = this;
            const put1: Put1 = { method: 'put1', reference, key, value, opts };
            return await this.channel.sendRequest('do-storage', put1, data => {
                const { error } = data;
                if (typeof error === 'string') throw new Error(error);
            });
        }
        throw new Error(`RpcStubDurableObjectStorage.put not implemented ${arg1} ${arg2} ${arg3}`);
    }
   
    delete(key: string, opts?: DurableObjectStorageWriteOptions): Promise<boolean>;
    delete(keys: readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<number>;
    delete(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<boolean | number> {
        return this._delete(keyOrKeys, opts);
    }

    async _delete(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<boolean | number> {
        if (typeof keyOrKeys === 'string') {
            const { reference } = this;
            const key = keyOrKeys;
            const delete1: Delete1 = { method: 'delete1', reference, key, opts };
            return await this.channel.sendRequest('do-storage', delete1, data => {
                const { error, value } = data;
                if (typeof error === 'string') throw new Error(error);
                return value;
            });
        }
        throw new Error(`RpcStubDurableObjectStorage.delete not implemented ${keyOrKeys} ${opts}`);
    }
   
    async list(options: DurableObjectStorageListOptions & DurableObjectStorageReadOptions = {}): Promise<Map<string, DurableObjectStorageValue>> {
        const { reference } = this;
        const list: List = { method: 'list', reference, options };
        return await this.channel.sendRequest('do-storage', list, data => {
            const { error, value } = data;
            if (typeof error === 'string') throw new Error(error);
            return value;
        });
    }

}

class RpcStubDurableObjectStorageTransaction implements DurableObjectStorageTransaction {
    private readonly storage: RpcStubDurableObjectStorage;

    constructor(storage: RpcStubDurableObjectStorage) {
        this.storage = storage;
    }

    rollback() {
        throw new Error(`RpcStubDurableObjectStorageTransaction.rollback not implemented`);
    }

    deleteAll(): Promise<void> {
        return this.storage.deleteAll();
    }

    get(key: string, opts?: DurableObjectStorageReadOptions): Promise<DurableObjectStorageValue | undefined>;
    get(keys: readonly string[], opts?: DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue>>;
    get(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue> | DurableObjectStorageValue | undefined> {
        return this.storage._get(keyOrKeys, opts);
    }

    put(key: string, value: DurableObjectStorageValue, opts?: DurableObjectStorageWriteOptions): Promise<void>;
    put(entries: Record<string, unknown>, opts?: DurableObjectStorageWriteOptions): Promise<void>;
    put(arg1: unknown, arg2?: unknown, arg3?: unknown): Promise<void> {
        return this.storage._put(arg1, arg2, arg3);
    }

    delete(key: string, opts?: DurableObjectStorageWriteOptions): Promise<boolean>;
    delete(keys: readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<number>;
    delete(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<boolean | number> {
        return this.storage._delete(keyOrKeys, opts);
    }

    list(options: DurableObjectStorageListOptions & DurableObjectStorageReadOptions = {}): Promise<Map<string, DurableObjectStorageValue>> {
        return this.storage.list(options);
    }

}
