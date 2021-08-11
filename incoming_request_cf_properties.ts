import { IncomingRequestCfProperties } from './deps_cf.ts';

export function makeIncomingRequestCfProperties(): IncomingRequestCfProperties {
    // deno-lint-ignore no-explicit-any
    return { colo: 'DNO' } as any;
}
