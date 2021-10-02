import { checkNumber, checkObject, checkString } from '../../common/check.ts';
import { getIsolateId } from './isolate_id.ts';

export class IsolateTracker {
    private static instance: IsolateTracker | undefined;

    private readonly colo;
    private readonly isolateId;
    private readonly durableObjects: WeakRef<DurableObjectInfoProvider>[] = [];

    private entryFetches = 0;
    
    private constructor(colo: string, isolateId: string) {
        this.colo = colo;
        this.isolateId = isolateId;
    }

    static get(colo: string): IsolateTracker {
        if (IsolateTracker.instance) return IsolateTracker.instance;
        const rt = new IsolateTracker(colo, getIsolateId());
        IsolateTracker.instance = rt;
        return rt;
    }

    incrementEntryFetch(): IsolateTracker {
        this.entryFetches++;
        return this;
    }

    registerDurableObject(obj: DurableObjectInfoProvider) {
        this.durableObjects.push(new WeakRef(obj));
    }

    info(): IsolateInfo {
        const { colo, isolateId, entryFetches } = this;
        const durableObjects: Record<string, DurableObjectInfo> = {};
        for (let i = this.durableObjects.length - 1; i >= 0; i--) {
            const obj = this.durableObjects[i].deref();
            if (obj) {
                const info = obj.durableObjectInfo;
                durableObjects[info.id] = info;
            } else {
                this.durableObjects.splice(i, 1);
            }
        }
        return { colo, isolateId, entryFetches, durableObjects };
    }

}

export interface IsolateInfo {
    readonly colo: string;
    readonly isolateId: string;
    readonly entryFetches: number;
    readonly durableObjects: Record<string, DurableObjectInfo>; // key = DurableObjectId.toString
}

// deno-lint-ignore no-explicit-any
export function checkIsolateInfo(info: any): info is IsolateInfo {
    checkObject('info', info);
    checkString('isolateId', info.isolateId);
    checkString('colo', info.colo);
    checkNumber('entryFetches', info.entryFetches);
    checkObject('durableObjects', info.durableObjects);
    for (const [_id, obj] of Object.entries(info.durableObjects)) {
        checkDurableObjectInfo(obj);
    }
    return true;
}

export interface DurableObjectInfoProvider {
    readonly durableObjectInfo: DurableObjectInfo;
}

export interface DurableObjectInfo {
    readonly type: string;
    readonly id: string; // DurableObjectId.toString
    readonly name?: string; // idFromName
    readonly fetches: number;
    readonly wsClients: number;
    readonly wsServers: number;
    readonly atts: Record<string, unknown>;
}

export interface MutableDurableObjectInfo {
    readonly type: string;
    readonly id: string; // DurableObjectId.toString
    name?: string; // idFromName
    fetches: number;
    wsClients: number;
    wsServers: number;
    readonly atts: Record<string, unknown>;
}

export function newMutableDurableObjectInfo(opts: { type: string, id: string }) {
    const { type, id } = opts;
    return { type, id, fetches: 0, wsClients: 0, wsServers: 0, atts: {} };
}

// deno-lint-ignore no-explicit-any
export function checkDurableObjectInfo(info: any): info is DurableObjectInfo {
    checkObject('info', info);
    checkString('type', info.type);
    checkString('id', info.id);
    if (info.name !== undefined) checkString('name', info.name);
    checkNumber('fetches', info.fetches);
    checkNumber('wsClients', info.wsClients);
    if (info.atts !== undefined) checkObject('atts', info.atts);
    return true;
}

// TODO horrible obviously, not a work around, will presumably prevent DOs from being evicted, cf workers does not implement WeakRef!
class WeakRef<T> {
    private readonly target;

    constructor(target: T) {
        this.target = target;
    }

    deref(): T | undefined {
        return this.target;
    }
    
}
