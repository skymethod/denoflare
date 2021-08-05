import { DurableObjectNamespace, DurableObjectId, DurableObjectStub, DurableObjectState, DurableObjectStorage } from 'https://github.com/skymethod/cloudflare-workers-types/raw/ab2ff7fd2ce19f35efdf0ab0fdcf857404ab0c17/cloudflare_workers_types.d.ts';
import { UnimplementedDurableObjectNamespace } from './unimplemented_cloudflare_stubs.ts';

export class InProcessDurableObjects {
    private readonly moduleWorkerExportedFunctions: Record<string, DurableObjectConstructor>;
    private readonly moduleWorkerEnv: Record<string, unknown>;

    constructor(moduleWorkerExportedFunctions: Record<string, DurableObjectConstructor>, moduleWorkerEnv: Record<string, unknown>) {
        this.moduleWorkerExportedFunctions = moduleWorkerExportedFunctions;
        this.moduleWorkerEnv = moduleWorkerEnv;
    }

    resolveDoNamespace(doNamespace: string): DurableObjectNamespace {
        if (doNamespace.startsWith('local:')) {
            const className = doNamespace.substring('local:'.length);
            const ctor = this.moduleWorkerExportedFunctions[className];
            if (ctor === undefined) throw new Error(`Durable object class '${className}' not found, candidates: ${Object.keys(this.moduleWorkerExportedFunctions).join(', ')}`);
            const state: DurableObjectState = new LocalDurableObjectState();
            const durableObject = new ctor(state, this.moduleWorkerEnv);
            return new LocalDurableObjectNamespace(durableObject);
    
        }
        return new UnimplementedDurableObjectNamespace(doNamespace);
    }

}

export type DurableObjectConstructor = new (state: DurableObjectState, env: Record<string, unknown>) => DurableObject;

export interface DurableObject {
    fetch(request: Request): Promise<Response>;
}

//

class LocalDurableObjectNamespace implements DurableObjectNamespace {

    private readonly durableObject: DurableObject;

    constructor(durableObject: DurableObject) {
        this.durableObject = durableObject;
    }

    newUniqueId(_opts?: { jurisdiction: 'eu' }): DurableObjectId {
        throw new Error(`LocalDurableObjectNamespace.newUniqueId not implemented.`);
    }

    idFromName(_name: string): DurableObjectId {
        throw new Error(`LocalDurableObjectNamespace.idFromName not implemented.`);
    }

    idFromString(_hexStr: string): DurableObjectId {
        throw new Error(`LocalDurableObjectNamespace.idFromString not implemented.`);
    }

    get(_id: DurableObjectId): DurableObjectStub {
        throw new Error(`LocalDurableObjectNamespace.get not implemented.`);
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
