import { DurableObjectState } from './cloudflare_workers_types.d.ts';
import { LocalDurableObjects } from './local_durable_objects.ts';
import { checkEqual, checkMatches } from './check.ts';

Deno.test('blockConcurrencyWhile', async () => {
    const objects = new LocalDurableObjects({ 'DurableObject1': DurableObject1 }, {});
    const ns = objects.resolveDoNamespace('local:DurableObject1');
    await ns.get(ns.idFromName('name')).fetch('https://foo');
});

Deno.test('newUniqueId', async () => {
    const objects = new LocalDurableObjects({ 'DurableObject2': DurableObject2 }, {});
    const ns = objects.resolveDoNamespace('local:DurableObject2');
    const id = ns.newUniqueId();
    checkMatches('id', id.toString(), /^[0-9a-f]{64}$/);
    const res = await ns.get(id).fetch('https://foo');
    const txt = await res.text();
    checkEqual('txt', txt, id.toString());
});

Deno.test('idFromName', async () => {
    const objects = new LocalDurableObjects({ 'DurableObject2': DurableObject2 }, {});
    const ns = objects.resolveDoNamespace('local:DurableObject2');
    const id = ns.idFromName('foo');
    checkMatches('id', id.toString(), /^[0-9a-f]{64}$/);
    const res = await ns.get(id).fetch('https://foo');
    const txt = await res.text();
    checkEqual('txt', txt, id.toString());
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

class DurableObject2 {
    readonly state: DurableObjectState;

    constructor(state: DurableObjectState, _env: Record<string, unknown>) {
        this.state = state;
    }

    fetch(_request: Request): Promise<Response> {
        return Promise.resolve(new Response(this.state.id.toString()));
    }

}
