// /// <reference lib="deno.worker" />

import { Data, RpcChannel } from './rpc_channel.ts';
import { Bodies, makeBodyResolverOverRpc, makeFetchOverRpc, packResponse, setReadBodyChunkRequestHandler, unpackRequest } from './rpc_fetch.ts';
import { SubtleCryptoPolyfill } from './subtle_crypto_polyfill.ts';

const _consoleLog = console.log;
const _consoleWarn = console.warn;

_consoleLog('worker: start');

SubtleCryptoPolyfill.applyIfNecessary();

class FetchEvent extends Event {
    readonly request: Request;
    responseFn: Promise<Response> | undefined;

    constructor(request: Request) {
        super('fetch');
        this.request = request;
    }

    waitUntil(promise: Promise<unknown>) {
        // _consoleLog('waitUntil', promise);
        promise.then(() => _consoleLog(`waitUntil complete`), e => _consoleWarn(e));
    }

    respondWith(responseFn: Promise<Response>) {
        // _consoleLog('respondWith', responseFn);
        if (this.responseFn) throw new Error(`respondWith: already called`);
        this.responseFn = responseFn;
    }
}

interface SmallDedicatedWorkerGlobalScope {
    onmessage: ((this: SmallDedicatedWorkerGlobalScope, ev: MessageEvent) => Data) | null;
    onmessageerror: ((this: SmallDedicatedWorkerGlobalScope, ev: MessageEvent) => Data) | null;
    close(): void;
    postMessage(message: Data): void;
}

// deno-lint-ignore no-explicit-any
const selfWorker = globalThis as any as SmallDedicatedWorkerGlobalScope;
const rpcChannel = new RpcChannel('worker', selfWorker.postMessage.bind(selfWorker));
selfWorker.onmessage = function(event) {
    if (rpcChannel.receiveMessage(event.data)) return;
    _consoleLog('worker: onmessage', event);
};
const bodies = new Bodies();
const fetchOverRpc = makeFetchOverRpc(rpcChannel, bodies);
if (fetchOverRpc === undefined) throw new Error();

class Self {
    private fetchListener: EventListener | undefined;

    addEventListener(type: string, listener: EventListener) {
        if (type === 'fetch') {
            this.fetchListener = listener;
        }
    }

    afterScript() {
        _consoleLog('afterScript');

        if (this.fetchListener) {
            const listener = this.fetchListener;
            setReadBodyChunkRequestHandler(rpcChannel, bodies);
            rpcChannel.addRequestHandler('fetch', async requestData => {
                const request = unpackRequest(requestData, makeBodyResolverOverRpc(rpcChannel));
                // deno-lint-ignore no-explicit-any
                (request as any).cf = { colo: 'DNO' };
                const e = new FetchEvent(request);
                await listener(e);
                const response = e.responseFn ? await e.responseFn : new Response('FetchEvent: no response');
                const responseData = packResponse(response, bodies);
                return responseData;
            });
        }
    }
}
if (Self === undefined) throw new Error();

// script worker contents inserted below
