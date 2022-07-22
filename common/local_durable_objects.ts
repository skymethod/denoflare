import { DurableObjectNamespace, DurableObjectId, DurableObjectStub, DurableObjectState, DurableObjectStorage } from './cloudflare_workers_types.d.ts';
import { Bytes } from './bytes.ts';
import { UnimplementedDurableObjectNamespace } from './unimplemented_cloudflare_stubs.ts';
import { consoleWarn } from './console.ts';
import { Mutex } from './mutex.ts';
import { checkMatches } from './check.ts';
import { InMemoryDurableObjectStorage } from './storage/in_memory_durable_object_storage.ts';
import { Sha1 } from './sha1.ts';

export class LocalDurableObjects {
    static readonly storageProviderFactories = new Map<string, DurableObjectStorageProvider>([[ 'memory', () => new InMemoryDurableObjectStorage() ]]);

    private readonly moduleWorkerExportedFunctions: Record<string, DurableObjectConstructor>;
    private readonly moduleWorkerEnv: Record<string, unknown>;
    private readonly durableObjects = new Map<string, Map<string, DurableObject>>(); // className -> hex id -> do
    private readonly storageProvider: DurableObjectStorageProvider;

    constructor(opts: { moduleWorkerExportedFunctions: Record<string, DurableObjectConstructor>, moduleWorkerEnv?: Record<string, unknown>, storageProvider?: DurableObjectStorageProvider }) {
        const { moduleWorkerExportedFunctions, moduleWorkerEnv, storageProvider } = opts;
        this.moduleWorkerExportedFunctions = moduleWorkerExportedFunctions;
        this.moduleWorkerEnv = moduleWorkerEnv || {};
        this.storageProvider = storageProvider || LocalDurableObjects.newDurableObjectStorage;
    }

    resolveDoNamespace(doNamespace: string): DurableObjectNamespace {
        if (doNamespace.startsWith('local:')) {
            const tokens = doNamespace.split(':');
            const className = tokens[1];
            this.findConstructorForClassName(className); // will throw if not found
            const options: Record<string, string> = {};
            for (const token of tokens.slice(2)) {
                const m = /^(.*?)=(.*?)$/.exec(token);
                if (!m) throw new Error(`Bad token '${token}' in local DO namespace: ${doNamespace}`);
                const name = m[1];
                const value = m[2];
                options[name] = value;
            }
            return new LocalDurableObjectNamespace(className, options, this.resolveDurableObject.bind(this));
        }
        return new UnimplementedDurableObjectNamespace(doNamespace);
    }

    static newDurableObjectStorage(className: string, id: DurableObjectId, options: Record<string, string>) {
        const storage = options.storage || 'memory';
        const rt = LocalDurableObjects.storageProviderFactories.get(storage);
        if (rt) return rt(className, id, options);
        throw new Error(`Bad storage: ${storage}`);
    }

    //

    private findConstructorForClassName(className: string): DurableObjectConstructor {
        const ctor = this.moduleWorkerExportedFunctions[className];
        if (ctor === undefined) throw new Error(`Durable object class '${className}' not found, candidates: ${Object.keys(this.moduleWorkerExportedFunctions).join(', ')}`);
        return ctor;
    }

    private resolveDurableObject(className: string, id: DurableObjectId, options: Record<string, string>): DurableObject {
        const idStr = id.toString();
        let classObjects = this.durableObjects.get(className);
        if (classObjects !== undefined) {
            const existing = classObjects.get(idStr);
            if (existing) return existing;
        }
        const ctor = this.findConstructorForClassName(className);
        const storage = this.storageProvider(className, id, options);
        const mutex = new Mutex();
        const state: DurableObjectState = new LocalDurableObjectState(id, storage, mutex);
        const durableObject = new ctor(state, this.moduleWorkerEnv);
        if (classObjects === undefined) {
            classObjects = new Map();
            this.durableObjects.set(className, classObjects);
        }
        // disable for now
        // putting a mutex around the entire fetch call is problematic if DO awaits a fetch that calls us back
        // it is too coarse anyway
        // TODO implement something like "gates"
        // const rt = new DurableObjectWithMutexAroundFetch(durableObject, mutex);
        const rt = durableObject;
        classObjects.set(idStr, rt);
        return rt;
    }

}

export type DurableObjectConstructor = new (state: DurableObjectState, env: Record<string, unknown>) => DurableObject;

export interface DurableObject {
    fetch(request: Request): Promise<Response>;
}

export type DurableObjectStorageProvider = (className: string, id: DurableObjectId, options: Record<string, string>) => DurableObjectStorage;

//

function computeSha1HexForStringInput(input: string): string {
    return new Sha1().update(Bytes.ofUtf8(input).array()).hex();
}

//

// deno-lint-ignore no-unused-vars
class DurableObjectWithMutexAroundFetch implements DurableObject {
    private readonly durableObject: DurableObject;
    private readonly mutex: Mutex;

    constructor(durableObject: DurableObject, mutex: Mutex) {
        this.durableObject = durableObject;
        this.mutex = mutex;
    }

    fetch(request: Request): Promise<Response> {
        return this.mutex.dispatch(() => this.durableObject.fetch(request));
    }

}

class LocalDurableObjectNamespace implements DurableObjectNamespace {
    private readonly className: string;
    private readonly options: Record<string, string>;
    private readonly resolver: DurableObjectResolver;
    private readonly namesToIds = new Map<string, DurableObjectId>();

    constructor(className: string, options: Record<string, string>, resolver: DurableObjectResolver) {
        this.className = className;
        this.options = options;
        this.resolver = resolver;
    }

    newUniqueId(_opts?: { jurisdiction: 'eu' }): DurableObjectId {
        // 64 hex chars
        return new LocalDurableObjectId(new Bytes(globalThis.crypto.getRandomValues(new Uint8Array(32))).hex());
    }

    idFromName(name: string): DurableObjectId {
        const existing = this.namesToIds.get(name);
        if (existing) return existing;
        const sha1a = computeSha1HexForStringInput(this.className);
        const sha1b = computeSha1HexForStringInput(name);
        const rt = `${sha1a.substring(0, 24)}${sha1b}`;
        this.namesToIds.set(name, rt);
        return rt;
    }

    idFromString(hexStr: string): DurableObjectId {
        return new LocalDurableObjectId(hexStr);
    }

    get(id: DurableObjectId): DurableObjectStub {
        return new LocalDurableObjectStub(this.className, id, this.options, this.resolver);
    }
}

type DurableObjectResolver = (className: string, id: DurableObjectId, options: Record<string, string>) => DurableObject;

class LocalDurableObjectStub implements DurableObjectStub {
    private readonly className: string;
    private readonly id: DurableObjectId;
    private readonly options: Record<string, string>;
    private readonly resolver: DurableObjectResolver;

    constructor(className: string, id: DurableObjectId, options: Record<string, string>, resolver: DurableObjectResolver) {
        this.className = className;
        this.id = id;
        this.options = options;
        this.resolver = resolver;
    }

    fetch(url: RequestInfo, init?: RequestInit): Promise<Response> {
        if (typeof url === 'string' && url.startsWith('/')) {
            url = 'https://fake-host' + url;
        }
        const req = typeof url === 'string' ? new Request(url, init) : init ? new Request(url, init) : url;
        return this.resolver(this.className, this.id, this.options).fetch(req);
    }

}

class LocalDurableObjectId implements DurableObjectId {
    private readonly hexString: string;

    constructor(hexString: string) {
        this.hexString = checkMatches('hexString', hexString, /^[0-9a-f]{64}$/);
    }

    toString(): string {
        return this.hexString;
    }
}

class LocalDurableObjectState implements DurableObjectState {
    readonly id: DurableObjectId;
    readonly storage: DurableObjectStorage;
    
    private readonly mutex: Mutex;

    constructor(id: DurableObjectId, storage: DurableObjectStorage, mutex: Mutex) {
        this.id = id;
        this.storage = storage;
        this.mutex = mutex;
    }

    waitUntil(promise: Promise<unknown>): void {
        // consoleLog('waitUntil', promise);
        promise.then(() => { 
            // consoleLog(`waitUntil complete`); 
        }, e => consoleWarn(e));
    }

    blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T> {
        return this.mutex.dispatch(fn);
    }

}
