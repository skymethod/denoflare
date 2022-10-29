import { isStringArray } from '../check.ts';
import { DurableObjectGetAlarmOptions, DurableObjectSetAlarmOptions, DurableObjectStorage, DurableObjectStorageListOptions, DurableObjectStorageReadOptions, DurableObjectStorageTransaction, DurableObjectStorageValue, DurableObjectStorageWriteOptions } from '../cloudflare_workers_types.d.ts';

export class InMemoryDurableObjectStorage implements DurableObjectStorage {

    // no semantic support for transactions, although they will work in simple cases

    private readonly sortedKeys: string[] = [];
    private readonly values = new Map<string, DurableObjectStorageValue>();

    async transaction<T>(closure: (txn: DurableObjectStorageTransaction) => T | PromiseLike<T>): Promise<T> {
        const txn = new InMemoryDurableObjectStorageTransaction(this);
        return await Promise.resolve(closure(txn));
    }

    sync(): Promise<void> {
        return Promise.resolve();
    }

    deleteAll(): Promise<void> {
        this.sortedKeys.splice(0);
        this.values.clear();
        return Promise.resolve();
    }

    get(key: string, opts?: DurableObjectStorageReadOptions): Promise<DurableObjectStorageValue | undefined>;
    get(keys: readonly string[], opts?: DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue>>;
    get(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue> | DurableObjectStorageValue | undefined> {
        return this._get(keyOrKeys, opts); 
    }

    _get(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue> | DurableObjectStorageValue | undefined> {
        if (typeof keyOrKeys === 'string' && Object.keys(opts || {}).length === 0) {
            const key = keyOrKeys;
            return Promise.resolve(structuredClone(this.values.get(key)));
        }
        if (isStringArray(keyOrKeys) && Object.keys(opts || {}).length === 0) {
            const keys = keyOrKeys;
            const rt = new Map<string, DurableObjectStorageValue>();
            for (const key of keys) {
                const value = this.values.get(key);
                if (value !== undefined) {
                    rt.set(key, structuredClone(value));
                }
            }
            return Promise.resolve(rt);
        }
        throw new Error(`InMemoryDurableObjectStorage.get not implemented`);
    }
   
    put(key: string, value: DurableObjectStorageValue, opts?: DurableObjectStorageWriteOptions): Promise<void>;
    put(entries: Record<string, unknown>, opts?: DurableObjectStorageWriteOptions): Promise<void>;
    put(arg1: unknown, arg2?: unknown, arg3?: unknown): Promise<void> {
        return this._put(arg1, arg2, arg3);
    }

    _put(arg1: unknown, arg2?: unknown, arg3?: unknown): Promise<void> {
        if (typeof arg1 === 'object' && arg2 === undefined && arg3 === undefined) {
            const entries = arg1 as Record<string, unknown>;
            let sortedKeysChanged = false;
            for (const [key, value] of Object.entries(entries)) {
                if (!this.sortedKeys.includes(key)) {
                    this.sortedKeys.push(key);
                    sortedKeysChanged = true;
                }
                const val = value as DurableObjectStorageValue;
                this.values.set(key, structuredClone(val));
            }
            if (sortedKeysChanged) {
                this.sortedKeys.sort();
            }
            return Promise.resolve();
        }
        if (typeof arg1 === 'string' && arg2 !== undefined && arg3 === undefined) {
            const key = arg1;
            const val = arg2 as DurableObjectStorageValue;
            let sortedKeysChanged = false;
            if (!this.sortedKeys.includes(key)) {
                this.sortedKeys.push(key);
                sortedKeysChanged = true;
            }
            this.values.set(key, structuredClone(val));
            if (sortedKeysChanged) {
                this.sortedKeys.sort();
            }
            return Promise.resolve();
        }
        throw new Error(`InMemoryDurableObjectStorage.put not implemented arg1=${arg1}, arg2=${arg2}, arg3=${arg3}`);
    }
   
    delete(key: string, opts?: DurableObjectStorageWriteOptions): Promise<boolean>;
    delete(keys: readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<number>;
    delete(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<boolean | number> {
        return this._delete(keyOrKeys, opts);
    }

    _delete(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<boolean | number> {
        if (typeof keyOrKeys === 'string' && Object.keys(opts || {}).length === 0) {
            const key = keyOrKeys;
            const i = this.sortedKeys.indexOf(key);
            if (i < 0) return Promise.resolve(false);
            this.sortedKeys.splice(i, 1);
            this.values.delete(key);
            return Promise.resolve(true);
        } else if (isStringArray(keyOrKeys) && Object.keys(opts || {}).length === 0) {
            const keys = keyOrKeys;
            let rt = 0;
            for (const key of keys) {
                const i = this.sortedKeys.indexOf(key);
                if (i > -1) {
                    this.sortedKeys.splice(i, 1);
                    this.values.delete(key);
                    rt++;
                }
            }
            return Promise.resolve(rt);
        }

        throw new Error(`InMemoryDurableObjectStorage.delete not implemented: ${typeof keyOrKeys}, ${opts}`);
    }
   
    list(options: DurableObjectStorageListOptions & DurableObjectStorageReadOptions = {}): Promise<Map<string, DurableObjectStorageValue>> {
        const { start, startAfter, end, prefix, limit, reverse, allowConcurrency, noCache } = options;
        for (const [ name, value ] of Object.entries({ allowConcurrency, noCache })) {
            if (value !== undefined) throw new Error(`InMemoryDurableObjectStorage.list(${name}) not implemented: ${JSON.stringify(options)}`);
        }

        const { sortedKeys, values } = this;
        const rt = new Map<string, DurableObjectStorageValue>();
        let orderedKeys = sortedKeys;
        if (reverse) orderedKeys = [...orderedKeys].reverse();
        for (const key of orderedKeys) {
            if (limit !== undefined && rt.size >= limit) return Promise.resolve(rt);
            if (prefix !== undefined && !key.startsWith(prefix)) continue;
            if (typeof start === 'string' && (reverse ? key > start : key < start)) continue;
            if (typeof startAfter === 'string' && (reverse ? key >= startAfter : key <= startAfter)) continue;
            if (typeof end === 'string' && (reverse ? key <= end : key >= end)) break;
            const value = structuredClone(values.get(key)!);
            rt.set(key, value);
        }
        return Promise.resolve(rt);
    }

    getAlarm(options?: DurableObjectGetAlarmOptions): Promise<number | null> {
        throw new Error(`InMemoryDurableObjectStorage.getAlarm not implemented options=${JSON.stringify(options)}`);
    }

    setAlarm(scheduledTime: number | Date, options?: DurableObjectSetAlarmOptions): Promise<void> {
        throw new Error(`InMemoryDurableObjectStorage.setAlarm not implemented scheduledTime=${scheduledTime} options=${JSON.stringify(options)}`);
    }
    
    deleteAlarm(options?: DurableObjectSetAlarmOptions): Promise<void> {
        throw new Error(`InMemoryDurableObjectStorage.deleteAlarm not implemented options=${JSON.stringify(options)}`);
    }

}

//

class InMemoryDurableObjectStorageTransaction implements DurableObjectStorageTransaction {
    private readonly storage: InMemoryDurableObjectStorage;

    constructor(storage: InMemoryDurableObjectStorage) {
        this.storage = storage;
    }

    rollback() {
        throw new Error(`InMemoryDurableObjectStorageTransaction.rollback not implemented`);
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
