import { DurableObjectNamespace, DurableObjectId, DurableObjectStub, Jurisdiction, LocationHint } from './cloudflare_workers_types.d.ts';

export class UnimplementedDurableObjectNamespace implements DurableObjectNamespace {
    readonly doNamespace: string;

    constructor(doNamespace: string) {
        this.doNamespace = doNamespace;
    }

    newUniqueId(_opts?: { jurisdiction: Jurisdiction }): DurableObjectId {
        throw new Error(`UnimplementedDurableObjectNamespace.newUniqueId not implemented.`);
    }

    idFromName(_name: string): DurableObjectId {
        throw new Error(`UnimplementedDurableObjectNamespace.idFromName not implemented.`);
    }

    idFromString(_hexStr: string): DurableObjectId {
        throw new Error(`UnimplementedDurableObjectNamespace.idFromString not implemented.`);
    }

    get(_id: DurableObjectId, _opts?: { locationHint?: LocationHint }): DurableObjectStub {
        throw new Error(`UnimplementedDurableObjectNamespace.get not implemented.`);
    }

    getByName(_name: string, _opts?: { locationHint?: LocationHint }): DurableObjectStub {
        throw new Error(`UnimplementedDurableObjectNamespace.getByName not implemented.`);
    }

    jurisdiction(_jurisdiction: Jurisdiction): DurableObjectNamespace {
        throw new Error(`UnimplementedDurableObjectNamespace.jurisdiction not implemented.`);
    }

}
