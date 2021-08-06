import { DurableObjectNamespace, DurableObjectId, DurableObjectStub, DurableObjectState, DurableObjectStorage } from './deps_cf.ts';
import { Bytes } from './bytes.ts';
import { UnimplementedDurableObjectNamespace } from './unimplemented_cloudflare_stubs.ts';

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
        const state: DurableObjectState = new LocalDurableObjectState();
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
    get id(): DurableObjectId { throw new Error(`LocalDurableObjectState.id not implemented.`); }
    get storage(): DurableObjectStorage { throw new Error(`LocalDurableObjectState.storage not implemented.`); }
    waitUntil(_promise: Promise<unknown>): void {
        throw new Error(`LocalDurableObjectState.waitUntil() not implemented.`);
    }
    blockConcurrencyWhile<T>(_fn: () => Promise<T>): Promise<T> {
        throw new Error(`LocalDurableObjectState.blockConcurrencyWhile() not implemented.`);
    }
}
