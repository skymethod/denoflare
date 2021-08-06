import { DurableObjectNamespace, DurableObjectId, DurableObjectStub } from './deps_cf.ts';

export class UnimplementedDurableObjectNamespace implements DurableObjectNamespace {
    readonly doNamespace: string;

    constructor(doNamespace: string) {
        this.doNamespace = doNamespace;
    }

    newUniqueId(_opts?: { jurisdiction: 'eu' }): DurableObjectId {
        throw new Error(`UnimplementedDurableObjectNamespace.newUniqueId not implemented.`);
    }

    idFromName(_name: string): DurableObjectId {
        throw new Error(`UnimplementedDurableObjectNamespace.idFromName not implemented.`);
    }

    idFromString(_hexStr: string): DurableObjectId {
        throw new Error(`UnimplementedDurableObjectNamespace.idFromString not implemented.`);
    }

    get(_id: DurableObjectId): DurableObjectStub {
        throw new Error(`UnimplementedDurableObjectNamespace.get not implemented.`);
    }

}
