import { IncomingRequestCfProperties } from './cloudflare_workers_types.d.ts';

export function makeIncomingRequestCfProperties(): IncomingRequestCfProperties {
    // deno-lint-ignore no-explicit-any
    return { colo: 'DNO', asn: 13335 } as any;
}
