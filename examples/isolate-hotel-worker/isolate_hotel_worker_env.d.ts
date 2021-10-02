import { DurableObjectNamespace } from './deps_worker.ts';

export interface IsolateHotelWorkerEnv {
    readonly version?: string;
    readonly flags?: string;
    readonly twitter?: string;
    readonly pushId?: string;
    readonly WorldDO: DurableObjectNamespace;
    readonly BroadcastDO: DurableObjectNamespace;
}
