import { DurableObjectState } from './cloudflare_workers_types.d.ts';
import { LocalDurableObjects } from './local_durable_objects.ts';

Deno.test('blockConcurrencyWhile', async () => {
    const objects = new LocalDurableObjects({ 'DurableObject1': DurableObject1 }, {});
    const ns = objects.resolveDoNamespace('local:DurableObject1');
    await ns.get(ns.idFromName('name')).fetch('https://foo');
});

//

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//

class DurableObject1 {

    constructor(state: DurableObjectState, _env: Record<string, unknown>) {
        console.log('ctor before');
        state.blockConcurrencyWhile(async () => {
            console.log('blockConcurrencyWhile before')
            await sleep(500);
            console.log('blockConcurrencyWhile after')
        })
        console.log('ctor after');
    }

    fetch(_request: Request): Promise<Response> {
        console.log('fetch');
        return Promise.resolve(new Response('ok'));
    }
    
}
