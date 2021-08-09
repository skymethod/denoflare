import { Binding, isDONamespaceBinding, isKVNamespaceBinding, isSecretBinding, isTextBinding } from './config.ts';
import { KVNamespace, DurableObjectNamespace, CfCache, CfCacheOptions, CfGlobalCaches, CloudflareWebSocketExtensions, WebSocketPair } from './deps_cf.ts';
import { consoleWarn } from './console.ts';
import { DenoflareServerWebSocket, DenoflareServerWebSocketLocator } from './denoflare_server_web_socket.ts';
import { DenoflareResponse } from './denoflare_response.ts';

export function defineModuleGlobals() {
    defineGlobalCaches();
    redefineGlobalFetch();
    defineGlobalWebsocketPair();
    redefineGlobalResponse();
}

export function applyWorkerEnv(target: Record<string, unknown>, bindings: Record<string, Binding>, kvNamespaceResolver: (kvNamespace: string) => KVNamespace, doNamespaceResolver: (doNamespace: string) => DurableObjectNamespace) {
    for (const [ name, binding ] of Object.entries(bindings)) {
        target[name] = computeBindingValue(binding, kvNamespaceResolver, doNamespaceResolver);
    }
}

export function defineScriptGlobals(bindings: Record<string, Binding>, kvNamespaceResolver: (kvNamespace: string) => KVNamespace, doNamespaceResolver: (doNamespace: string) => DurableObjectNamespace) {
    applyWorkerEnv(globalThisAsAny(), bindings, kvNamespaceResolver, doNamespaceResolver);
    defineGlobalCaches();
    redefineGlobalResponse();
}

export async function dispatchFetchEvent(request: Request, cf: { colo: string }, listener: EventListener): Promise<Response> {
    // deno-lint-ignore no-explicit-any
    (request as any).cf = cf;
    const e = new FetchEvent(request);
    await listener(e);
    if (e.responseFn === undefined) throw new Error(`Event handler did not set a response using respondWith`);
    const response = await e.responseFn;
    return response;
}

//

const _fetch = fetch;

function redefineGlobalFetch() {
    // https://github.com/denoland/deno/issues/7660

    // deno-lint-ignore no-explicit-any
    const fetchFromDeno = function(arg1: any, arg2: any) {
        if (typeof arg1 === 'string' && arg2 === undefined) {
            let url = arg1 as string;
            if (url.startsWith('https://1.1.1.1/')) {
                url = 'https://one.one.one.one/' + url.substring('https://1.1.1.1/'.length);
            }
            arg1 = url;
        }
        return _fetch(arg1, arg2);
    };

    globalThisAsAny().fetch = fetchFromDeno;
}

function defineGlobalCaches() {
    const caches: CfGlobalCaches = new NoopCfGlobalCaches();
    globalThisAsAny()['caches'] = caches;
}

function redefineGlobalResponse() {
    globalThisAsAny()['Response'] = DenoflareResponse;
}

function defineGlobalWebsocketPair() {
    globalThisAsAny()['WebSocketPair'] = DenoflareWebSocketPair;
}

// deno-lint-ignore no-explicit-any
function globalThisAsAny(): any {
    return globalThis;
}

function computeBindingValue(binding: Binding, kvNamespaceResolver: (kvNamespace: string) => KVNamespace, doNamespaceResolver: (doNamespace: string) => DurableObjectNamespace): string | KVNamespace | DurableObjectNamespace {
    if (isTextBinding(binding)) return binding.value;
    if (isSecretBinding(binding)) return binding.secret;
    if (isKVNamespaceBinding(binding)) return kvNamespaceResolver(binding.kvNamespace);
    if (isDONamespaceBinding(binding)) return doNamespaceResolver(binding.doNamespace);
    throw new Error(`TODO implement binding ${JSON.stringify(binding)}`);
}

//

class NoopCfGlobalCaches implements CfGlobalCaches {
    readonly default = new NoopCfCache();

    private namedCaches = new Map<string, NoopCfCache>();

    open(cacheName: string): Promise<CfCache> {
        const existing = this.namedCaches.get(cacheName);
        if (existing) return Promise.resolve(existing);
        const cache = new NoopCfCache();
        this.namedCaches.set(cacheName, cache);
        return Promise.resolve(cache);
    }
    
}

class NoopCfCache implements CfCache {

    put(_request: string | Request, _response: Response): Promise<undefined> {
        return Promise.resolve(undefined);
    }
    
    match(_request: string | Request, _options?: CfCacheOptions): Promise<Response | undefined> {
        return Promise.resolve(undefined);
    }

    delete(_request: string | Request, _options?: CfCacheOptions): Promise<boolean> {
        return Promise.resolve(false);
    }

}

class DenoflareWebSocketPair implements WebSocketPair {
    readonly 0: WebSocket; // client, returned in the ResponseInit
    readonly 1: WebSocket & CloudflareWebSocketExtensions; // server, accept(), addEventListener(), send() and close()

    constructor() {
        const server = new DenoflareServerWebSocket();
        // deno-lint-ignore no-explicit-any
        this['0'] = new DenoflareClientWebSocket(server) as any;
        // deno-lint-ignore no-explicit-any
        this['1'] = server as any;
    }
}

class DenoflareClientWebSocket implements CloudflareWebSocketExtensions, DenoflareServerWebSocketLocator {
    private readonly server: DenoflareServerWebSocket;

    constructor(server: DenoflareServerWebSocket) {
        this.server = server;
    }

    getDenoflareServerWebSocket(): DenoflareServerWebSocket | undefined {
        return this.server;
    }

    //

    accept() {
        throw new Error(`DenoflareClientWebSocket.accept()`);
    }

    send(_data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        throw new Error(`DenoflareClientWebSocket.send()`);
    }

    close(_code?: number, _reason?: string): void {
        throw new Error(`DenoflareClientWebSocket.close()`);
    }

    addEventListener(_type: string, _listener: EventListenerOrEventListenerObject, _options?: boolean | AddEventListenerOptions): void {
        throw new Error(`DenoflareClientWebSocket.addEventListener()`);
    }

}

//

export class FetchEvent extends Event {
    readonly request: Request;
    responseFn: Promise<Response> | undefined;

    constructor(request: Request) {
        super('fetch');
        this.request = request;
    }

    waitUntil(promise: Promise<unknown>) {
        // consoleLog('waitUntil', promise);
        promise.then(() => { 
            // consoleLog(`waitUntil complete`); 
        }, e => consoleWarn(e));
    }

    respondWith(responseFn: Promise<Response>) {
        // consoleLog('respondWith', responseFn);
        if (this.responseFn) throw new Error(`respondWith: already called`);
        this.responseFn = responseFn;
    }
}
