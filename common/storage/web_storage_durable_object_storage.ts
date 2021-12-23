import { DurableObjectStorage, DurableObjectStorageListOptions, DurableObjectStorageReadOptions, DurableObjectStorageTransaction, DurableObjectStorageValue, DurableObjectStorageWriteOptions } from '../cloudflare_workers_types.d.ts';

export class WebStorageDurableObjectStorage implements DurableObjectStorage {

    // no semantic support for transactions, although they will work in simple cases

    private readonly prefix: string;

    constructor(prefix: string) {
        this.prefix = prefix;
    }

    async transaction<T>(closure: (txn: DurableObjectStorageTransaction) => T | PromiseLike<T>): Promise<T> {
        const txn = new WebStorageDurableObjectStorageTransaction(this);
        return await Promise.resolve(closure(txn));
    }

    deleteAll(): Promise<void> {
        const { prefix } = this;
        const index = readSortedIndex(prefix);
        for (const key of index) {
            localStorage.removeItem(computeValueStorageKey(prefix, key));
        }
        localStorage.removeItem(computeIndexStorageKey(prefix));
        return Promise.resolve();
    }

    get(key: string, opts?: DurableObjectStorageReadOptions): Promise<DurableObjectStorageValue | undefined>;
    get(keys: readonly string[], opts?: DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue>>;
    get(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue> | DurableObjectStorageValue | undefined> {
        return this._get(keyOrKeys, opts); 
    }

    _get(keyOrKeys: string | readonly string[], opts: DurableObjectStorageReadOptions = {}): Promise<Map<string, DurableObjectStorageValue> | DurableObjectStorageValue | undefined> {
        if (typeof keyOrKeys === 'string' && Object.keys(opts).length === 0) {
            const key = keyOrKeys;
            const packed = localStorage.getItem(computeValueStorageKey(this.prefix, key));
            return Promise.resolve(packed ? unpackDurableObjectStorageValue(packed) : undefined);
        }
        throw new Error(`WebStorageDurableObjectStorage.get not implemented ${typeof keyOrKeys}, ${opts}`);
    }
   
    put(key: string, value: DurableObjectStorageValue, opts?: DurableObjectStorageWriteOptions): Promise<void>;
    put(entries: Record<string, unknown>, opts?: DurableObjectStorageWriteOptions): Promise<void>;
    put(arg1: unknown, arg2?: unknown, arg3?: unknown): Promise<void> {
        return this._put(arg1, arg2, arg3);
    }

    _put(arg1: unknown, arg2?: unknown, arg3?: unknown): Promise<void> {
        if (typeof arg1 === 'string' && typeof arg2 === 'string') {
            const key = arg1;
            const value = arg2;
            const opts = arg3;
            if (!opts || typeof opts === 'object' && Object.keys(opts).length === 0) {
                const { prefix } = this;
                localStorage.setItem(computeValueStorageKey(prefix, key), packDurableObjectStorageValue(value));
                const index = readSortedIndex(prefix);
                if (!index.includes(key)) {
                    index.push(key);
                    writeSortedIndex(prefix, index);
                }
                return Promise.resolve();
            }
           
        }
        throw new Error(`WebStorageDurableObjectStorage.put not implemented: ${arg1} ${arg2} ${arg3}`);
    }
   
    delete(key: string, opts?: DurableObjectStorageWriteOptions): Promise<boolean>;
    delete(keys: readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<number>;
    delete(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<boolean | number> {
        return this._delete(keyOrKeys, opts);
    }

    _delete(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<boolean | number> {
        if (typeof keyOrKeys === 'string') {
            const key = keyOrKeys;
            if (!opts || typeof opts === 'object' && Object.keys(opts).length === 0) {
                const { prefix } = this;
                localStorage.removeItem(computeValueStorageKey(prefix, key));
                const index = readSortedIndex(prefix);
                const i = index.indexOf(key);
                if (i > -1) {
                    index.splice(i, 1);
                    writeSortedIndex(prefix, index);
                }
                return Promise.resolve(i > -1);
            }
        }
        throw new Error(`WebStorageDurableObjectStorage.delete not implemented: ${keyOrKeys} ${opts}`);
    }
   
    async list(options: DurableObjectStorageListOptions & DurableObjectStorageReadOptions = {}): Promise<Map<string, DurableObjectStorageValue>> {
        if (Object.keys(options).length === 0) {
            const index = readSortedIndex(this.prefix);
            const rt = new Map<string, DurableObjectStorageValue>();
            for (const key of index) {
                const value = await this._get(key);
                if (!value) throw new Error(`Index value not found: ${key}`);
                rt.set(key, value);
            }
            return Promise.resolve(rt);
        }
        throw new Error(`WebStorageDurableObjectStorage.list not implemented: options=${options}`);
    }

}

//

function computeValueStorageKey(prefix: string, key: string): string {
    return `${prefix}:v:${key}`;
}

function computeIndexStorageKey(prefix: string) {
    return `${prefix}:i`;
}

// deno-lint-ignore no-explicit-any
function isStringArray(obj: any): obj is string[] {
    return Array.isArray(obj) && obj.every(v => typeof v === 'string');
}

function readSortedIndex(prefix: string): string[] {
    const index = localStorage.getItem(computeIndexStorageKey(prefix)) ||  '[]';
    const obj = JSON.parse(index);
    if (!isStringArray(obj)) throw new Error(`Bad index value: ${obj}`);
    return obj.sort();
}

function writeSortedIndex(prefix: string, index: string[]) {
    localStorage.setItem(computeIndexStorageKey(prefix), JSON.stringify(index));
}

function unpackDurableObjectStorageValue(packed: string): DurableObjectStorageValue {
    const obj = JSON.parse(packed);
    if (typeof obj === 'object' && typeof obj.k === 'string') {
        if (obj.k === 's' && typeof obj.v === 'string') {
            return obj.v;
        }
    }
    throw new Error(`WebStorageDurableObjectStorage.unpackDurableObjectStorageValue: packed value not implemented: ${packed}`);
}

function packDurableObjectStorageValue(value: DurableObjectStorageValue): string {
    if (typeof value === 'string') {
        return JSON.stringify({ k: 's', v: value } as PackedStringValue);
    }
    throw new Error(`WebStorageDurableObjectStorage.packDurableObjectStorageValue: value not implemented: ${value}`);
}

//

type PackedValue = PackedStringValue;
type PackedStringValue = { k: 's', v: string };

class WebStorageDurableObjectStorageTransaction implements DurableObjectStorageTransaction {
    private readonly storage: WebStorageDurableObjectStorage;

    constructor(storage: WebStorageDurableObjectStorage) {
        this.storage = storage;
    }

    rollback() {
        throw new Error(`WebStorageDurableObjectStorageTransaction.rollback not implemented`);
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
