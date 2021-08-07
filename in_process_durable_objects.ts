import { DurableObjectNamespace, DurableObjectId, DurableObjectStub, DurableObjectState, DurableObjectStorage, DurableObjectStorageValue, DurableObjectStorageReadOptions, DurableObjectStorageWriteOptions, DurableObjectStorageTransaction, DurableObjectStorageListOptions } from './deps_cf.ts';
import { Bytes } from './bytes.ts';
import { UnimplementedDurableObjectNamespace } from './unimplemented_cloudflare_stubs.ts';
import { consoleWarn } from './console.ts';

export class InProcessDurableObjects {
    private readonly moduleWorkerExportedFunctions: Record<string, DurableObjectConstructor>;
    private readonly moduleWorkerEnv: Record<string, unknown>;
    private readonly durableObjects = new Map<string, Map<string, DurableObject>>(); // className -> hex id -> do

    constructor(moduleWorkerExportedFunctions: Record<string, DurableObjectConstructor>, moduleWorkerEnv: Record<string, unknown>) {
        this.moduleWorkerExportedFunctions = moduleWorkerExportedFunctions;
        this.moduleWorkerEnv = moduleWorkerEnv;
    }

    resolveDoNamespace(doNamespace: string): DurableObjectNamespace {
        if (doNamespace.startsWith('local:')) {
            const className = doNamespace.substring('local:'.length);
            this.findConstructorForClassName(className); // will throw if not found
            return new LocalDurableObjectNamespace(className, this.resolveDurableObject.bind(this));
        }
        return new UnimplementedDurableObjectNamespace(doNamespace);
    }

    //

    private findConstructorForClassName(className: string): DurableObjectConstructor {
        const ctor = this.moduleWorkerExportedFunctions[className];
        if (ctor === undefined) throw new Error(`Durable object class '${className}' not found, candidates: ${Object.keys(this.moduleWorkerExportedFunctions).join(', ')}`);
        return ctor;
    }

    private resolveDurableObject(className: string, id: DurableObjectId): DurableObject {
        const idStr = id.toString();
        let classObjects = this.durableObjects.get(className);
        if (classObjects !== undefined) {
            const existing = classObjects.get(idStr);
            if (existing) return existing;
        }
        const ctor = this.findConstructorForClassName(className);
        const storage = new InMemoryDurableObjectStorage();
        const state: DurableObjectState = new LocalDurableObjectState(id, storage);
        const durableObject = new ctor(state, this.moduleWorkerEnv);
        if (classObjects === undefined) {
            classObjects = new Map();
            this.durableObjects.set(className, classObjects);
        }
        classObjects.set(idStr, durableObject);
        return durableObject;
    }

}

export type DurableObjectConstructor = new (state: DurableObjectState, env: Record<string, unknown>) => DurableObject;

export interface DurableObject {
    fetch(request: Request): Promise<Response>;
}

//

class LocalDurableObjectNamespace implements DurableObjectNamespace {
    private readonly className: string;
    private readonly resolver: DurableObjectResolver;

    constructor(className: string, resolver: DurableObjectResolver) {
        this.className = className;
        this.resolver = resolver;
    }

    newUniqueId(_opts?: { jurisdiction: 'eu' }): DurableObjectId {
        throw new Error(`LocalDurableObjectNamespace.newUniqueId not implemented.`);
    }

    idFromName(name: string): DurableObjectId {
        return new LocalDurableObjectId(Bytes.ofUtf8(name).hex());
    }

    idFromString(hexStr: string): DurableObjectId {
        return new LocalDurableObjectId(hexStr);
    }

    get(id: DurableObjectId): DurableObjectStub {
        return new LocalDurableObjectStub(this.className, id, this.resolver);
    }
}

type DurableObjectResolver = (className: string, id: DurableObjectId) => DurableObject;

class LocalDurableObjectStub implements DurableObjectStub {
    private readonly className: string;
    private readonly id: DurableObjectId;
    private readonly resolver: DurableObjectResolver;

    constructor(className: string, id: DurableObjectId, resolver: DurableObjectResolver) {
        this.className = className;
        this.id = id;
        this.resolver = resolver;
    }

    fetch(url: RequestInfo, init?: RequestInit): Promise<Response> {
        if (typeof url === 'string' && url.startsWith('/')) {
            url = 'https://fake-host' + url;
        }
        const req = typeof url === 'string' ? new Request(url, init) : init ? new Request(url, init) : url;
        return this.resolver(this.className, this.id).fetch(req);
    }

}

class LocalDurableObjectId implements DurableObjectId {
    private readonly hexString: string;

    constructor(hexString: string) {
        this.hexString = hexString;
    }

    toString(): string {
        return this.hexString;
    }
}

class LocalDurableObjectState implements DurableObjectState {
    readonly id: DurableObjectId;
    readonly storage: DurableObjectStorage;

    constructor(id: DurableObjectId, storage: DurableObjectStorage) {
        this.id = id;
        this.storage = storage;
    }

    waitUntil(promise: Promise<unknown>): void {
        // consoleLog('waitUntil', promise);
        promise.then(() => { 
            // consoleLog(`waitUntil complete`); 
        }, e => consoleWarn(e));
    }

    blockConcurrencyWhile<T>(_fn: () => Promise<T>): Promise<T> {
        throw new Error(`LocalDurableObjectState.blockConcurrencyWhile() not implemented.`);
    }

}

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

}

class InMemoryDurableObjectStorage implements DurableObjectStorage {

    private readonly sortedKeys: string[] = [];
    private readonly values = new Map<string, DurableObjectStorageValue>();

    async transaction<T>(closure: (txn: DurableObjectStorageTransaction) => T | PromiseLike<T>): Promise<T> {
        const txn = new InMemoryDurableObjectStorageTransaction(this);
        return await Promise.resolve(closure(txn));
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
        if (typeof keyOrKeys === 'string' && opts === undefined) {
            const key = keyOrKeys;
            return Promise.resolve(this.values.get(key));
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

    _delete(_keyOrKeys: string | readonly string[], _opts?: DurableObjectStorageWriteOptions): Promise<boolean | number> {
        throw new Error(`InMemoryDurableObjectStorage.delete not implemented`);
    }
   
    list(options: DurableObjectStorageListOptions & DurableObjectStorageReadOptions = {}): Promise<Map<string, DurableObjectStorageValue>> {
        if (options.allowConcurrency === undefined && options.end === undefined && options.noCache === undefined && options.start === undefined) {
            const { prefix, limit, reverse } = options;
            const { sortedKeys, values } = this;
            const rt = new Map<string, DurableObjectStorageValue>();
            let orderedKeys = sortedKeys;
            if (reverse) orderedKeys = [...orderedKeys].reverse();
            for (const key of orderedKeys) {
                if (limit !== undefined && rt.size >= limit) return Promise.resolve(rt);
                if (prefix !== undefined && !key.startsWith(prefix)) continue;
                const value = structuredClone(values.get(key)!);
                rt.set(key, value);
            }
            return Promise.resolve(rt);
        }
        throw new Error(`InMemoryDurableObjectStorage.list not implemented options=${JSON.stringify(options)}`);
    }

}

function structuredClone<T>(value: T): T {
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
        if (!isJsonSafe(value)) throw new Error(`structuredClone: object value is not json-safe: ${value}`);
        return JSON.parse(JSON.stringify(value));
    }
    throw new Error(`structuredClone not implemented for ${typeof value} ${value}`);
}

function isJsonSafe(value: unknown): boolean {
    if (value === undefined) return true;
    if (value === null) return true;
    if (typeof value === 'boolean') return true;
    if (typeof value === 'string') return true;
    if (typeof value === 'number') return true;
    if (typeof value === 'object') {
        if (Array.isArray(value)) {
            return value.every(isJsonSafe);
        }
        return Object.values(value as Record<string, unknown>).every(isJsonSafe);
    }
    throw new Error(`isJsonSafe not implemented for ${typeof value} ${value}`);
}
