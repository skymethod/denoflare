import { isStringArray } from '../check.ts';
import { Bytes } from '../bytes.ts';
import { DurableObjectGetAlarmOptions, DurableObjectId, DurableObjectSetAlarmOptions, DurableObjectStorage, DurableObjectStorageListOptions, DurableObjectStorageReadOptions, DurableObjectStorageTransaction, DurableObjectStorageValue, DurableObjectStorageWriteOptions } from '../cloudflare_workers_types.d.ts';

export class WebStorageDurableObjectStorage implements DurableObjectStorage {

    // no semantic support for transactions, although they will work in simple cases

    private readonly prefix: string;

    constructor(prefix: string) {
        this.prefix = prefix;
    }

    static provider(className: string, id: DurableObjectId, options: Record<string, string>) {
        return new WebStorageDurableObjectStorage([options.container || 'default', className, id.toString()].join(':'));
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
        } else if (isStringArray(keyOrKeys) && Object.keys(opts).length === 0) {
            const keys = keyOrKeys;
            const rt = new Map<string, DurableObjectStorageValue>();
            for (const key of keys) {
                const packed = localStorage.getItem(computeValueStorageKey(this.prefix, key));
                if (packed) {
                    rt.set(key, unpackDurableObjectStorageValue(packed));
                }
            }
            return Promise.resolve(rt);
        }
        throw new Error(`WebStorageDurableObjectStorage.get not implemented ${typeof keyOrKeys}, ${opts}`);
    }
   
    put(key: string, value: DurableObjectStorageValue, opts?: DurableObjectStorageWriteOptions): Promise<void>;
    put(entries: Record<string, unknown>, opts?: DurableObjectStorageWriteOptions): Promise<void>;
    put(arg1: unknown, arg2?: unknown, arg3?: unknown): Promise<void> {
        return this._put(arg1, arg2, arg3);
    }

    _put(arg1: unknown, arg2?: unknown, arg3?: unknown): Promise<void> {
        const { prefix } = this;
        if (typeof arg1 === 'string') {
            const key = arg1;
            const value = arg2;
            const opts = arg3;
            if (!opts || typeof opts === 'object' && Object.keys(opts).length === 0) {
                localStorage.setItem(computeValueStorageKey(prefix, key), packDurableObjectStorageValue(value as DurableObjectStorageValue));
                const index = readSortedIndex(prefix);
                if (!index.includes(key)) {
                    index.push(key);
                    writeSortedIndex(prefix, index);
                }
                return Promise.resolve();
            }
        } else if (typeof arg1 === 'object' && !Array.isArray(arg1)) {
            const entries = arg1 as Record<string, unknown>;
            const opts = arg2 as DurableObjectStorageWriteOptions | undefined;
            if (Object.keys(opts || {}).length === 0) {
                const index = readSortedIndex(prefix);
                let indexChanged = false;
                for (const [ key, value ] of Object.entries(entries)) {
                    localStorage.setItem(computeValueStorageKey(prefix, key), packDurableObjectStorageValue(value as DurableObjectStorageValue));
                    if (!index.includes(key)) {
                        index.push(key);
                        indexChanged = true;
                    }
                }
                if (indexChanged) writeSortedIndex(prefix, index);
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
        const { prefix } = this;
        if (typeof keyOrKeys === 'string' && Object.keys(opts || {}).length === 0) {
            const key = keyOrKeys;
            localStorage.removeItem(computeValueStorageKey(prefix, key));
            const index = readSortedIndex(prefix);
            const i = index.indexOf(key);
            if (i > -1) {
                index.splice(i, 1);
                writeSortedIndex(prefix, index);
            }
            return Promise.resolve(i > -1);
        } else if (isStringArray(keyOrKeys) && Object.keys(opts || {}).length === 0) {
            const keys = keyOrKeys;
            let rt = 0;
            const index = readSortedIndex(prefix);
            for (const key of keys) {
                localStorage.removeItem(computeValueStorageKey(prefix, key));
                const i = index.indexOf(key);
                if (i > -1) {
                    index.splice(i, 1);
                    rt++;
                }
            }
            if (rt > 0) writeSortedIndex(prefix, index);
            return Promise.resolve(rt);
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

    getAlarm(options?: DurableObjectGetAlarmOptions): Promise<number | null> {
        throw new Error(`WebStorageDurableObjectStorage.getAlarm not implemented options=${JSON.stringify(options)}`);
    }

    setAlarm(scheduledTime: number | Date, options?: DurableObjectSetAlarmOptions): Promise<void> {
        throw new Error(`WebStorageDurableObjectStorage.setAlarm not implemented scheduledTime=${scheduledTime} options=${JSON.stringify(options)}`);
    }
    
    deleteAlarm(options?: DurableObjectSetAlarmOptions): Promise<void> {
        throw new Error(`WebStorageDurableObjectStorage.deleteAlarm not implemented options=${JSON.stringify(options)}`);
    }
    
}

//

function computeValueStorageKey(prefix: string, key: string): string {
    return `${prefix}:v:${key}`;
}

function computeIndexStorageKey(prefix: string) {
    return `${prefix}:i`;
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
    if (typeof obj.u8 === 'string') return Bytes.ofBase64(obj.u8).array();
    return obj.v as DurableObjectStorageValue;
}

function packDurableObjectStorageValue(value: DurableObjectStorageValue): string {
    if (value instanceof Uint8Array) return JSON.stringify({ u8: new Bytes(value).base64() });
    return JSON.stringify({ v: value }); // for now, we can only support types that json round-trip
}

//

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

    getAlarm(options?: DurableObjectGetAlarmOptions): Promise<number | null> {
        return this.storage.getAlarm(options);
    }

    setAlarm(scheduledTime: number | Date, options?: DurableObjectSetAlarmOptions): Promise<void> {
        return this.storage.setAlarm(scheduledTime, options);
    }
    
    deleteAlarm(options?: DurableObjectSetAlarmOptions): Promise<void> {
        return this.storage.deleteAlarm(options);
    }
    
}
