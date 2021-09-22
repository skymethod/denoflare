import { DurableObjectNamespace } from './deps.ts';

export interface TieredWorkerEnv {
    readonly ColoTierDO: DurableObjectNamespace;
}

// deno-lint-ignore no-empty-interface
export interface DurableObjectEnv {
    
}
