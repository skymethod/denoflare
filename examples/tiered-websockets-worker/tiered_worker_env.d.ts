import { DurableObjectNamespace } from './deps.ts';

export interface TieredWorkerEnv {
    readonly ColoTierDO: DurableObjectNamespace;
}
