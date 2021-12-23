import { DurableObjectStorage, DurableObjectStorageListOptions, DurableObjectStorageReadOptions, DurableObjectStorageTransaction, DurableObjectStorageValue, DurableObjectStorageWriteOptions } from './cloudflare_workers_types.d.ts';
import { DurableObjectStorageProvider } from './local_durable_objects.ts';
import { RpcChannel } from './rpc_channel.ts';

export function makeRpcDurableObjectStorageProvider(channel: RpcChannel): DurableObjectStorageProvider {
    return options => {
        return new RpcDurableObjectStorage(channel, options);
    }
}

//

class RpcDurableObjectStorage implements DurableObjectStorage {
    private readonly channel: RpcChannel;
    private readonly options: Record<string, string>;

    constructor(channel: RpcChannel, options: Record<string, string>) {
        this.channel = channel;
        this.options = options;
    }

    
    async transaction<T>(closure: (txn: DurableObjectStorageTransaction) => T | PromiseLike<T>): Promise<T> {
        const txn = new RpcDurableObjectStorageTransaction(this);
        return await Promise.resolve(closure(txn));
    }

    deleteAll(): Promise<void> {
        throw new Error(`RpcDurableObjectStorage.deleteAll not implemented`);
    }

    get(key: string, opts?: DurableObjectStorageReadOptions): Promise<DurableObjectStorageValue | undefined>;
    get(keys: readonly string[], opts?: DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue>>;
    get(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue> | DurableObjectStorageValue | undefined> {
        return this._get(keyOrKeys, opts); 
    }

    _get(keyOrKeys: string | readonly string[], opts: DurableObjectStorageReadOptions = {}): Promise<Map<string, DurableObjectStorageValue> | DurableObjectStorageValue | undefined> {
        throw new Error(`RpcDurableObjectStorage.get not implemented ${keyOrKeys} ${opts}`);
    }
   
    put(key: string, value: DurableObjectStorageValue, opts?: DurableObjectStorageWriteOptions): Promise<void>;
    put(entries: Record<string, unknown>, opts?: DurableObjectStorageWriteOptions): Promise<void>;
    put(arg1: unknown, arg2?: unknown, arg3?: unknown): Promise<void> {
        return this._put(arg1, arg2, arg3);
    }

    _put(arg1: unknown, arg2?: unknown, arg3?: unknown): Promise<void> {
        throw new Error(`RpcDurableObjectStorage.put not implemented ${arg1} ${arg2} ${arg3}`);
    }
   
    delete(key: string, opts?: DurableObjectStorageWriteOptions): Promise<boolean>;
    delete(keys: readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<number>;
    delete(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<boolean | number> {
        return this._delete(keyOrKeys, opts);
    }

    _delete(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<boolean | number> {
        throw new Error(`RpcDurableObjectStorage.delete not implemented ${keyOrKeys} ${opts}`);
    }
   
    list(options: DurableObjectStorageListOptions & DurableObjectStorageReadOptions = {}): Promise<Map<string, DurableObjectStorageValue>> {
        throw new Error(`RpcDurableObjectStorage.list not implemented ${options}`);
    }
}

class RpcDurableObjectStorageTransaction implements DurableObjectStorageTransaction {
    private readonly storage: RpcDurableObjectStorage;

    constructor(storage: RpcDurableObjectStorage) {
        this.storage = storage;
    }

    rollback() {
        throw new Error(`RpcDurableObjectStorageTransaction.rollback not implemented`);
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
