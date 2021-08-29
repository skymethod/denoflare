import { Binding, isDONamespaceBinding, isKVNamespaceBinding, isSecretBinding, isTextBinding } from './config.ts';
import { KVNamespace, DurableObjectNamespace, CfGlobalCaches, CloudflareWebSocketExtensions, WebSocketPair } from './cloudflare_workers_types.d.ts';
import { DenoflareServerWebSocket, DenoflareServerWebSocketLocator } from './denoflare_server_web_socket.ts';
import { DenoflareResponse } from './denoflare_response.ts';

export type GlobalCachesProvider = () => CfGlobalCaches;
export type KVNamespaceProvider = (kvNamespace: string) => KVNamespace;
export type DONamespaceProvider = (doNamespace: string) => DurableObjectNamespace;

export function defineModuleGlobals(globalCachesProvider: GlobalCachesProvider) {
    defineGlobalCaches(globalCachesProvider);
    redefineGlobalFetch();
    defineGlobalWebsocketPair();
    redefineGlobalResponse();
}

export function applyWorkerEnv(target: Record<string, unknown>, bindings: Record<string, Binding>, kvNamespaceProvider: KVNamespaceProvider, doNamespaceProvider: DONamespaceProvider) {
    for (const [ name, binding ] of Object.entries(bindings)) {
        target[name] = computeBindingValue(binding, kvNamespaceProvider, doNamespaceProvider);
    }
}

export function defineScriptGlobals(bindings: Record<string, Binding>, globalCachesProvider: GlobalCachesProvider, kvNamespaceProvider: KVNamespaceProvider, doNamespaceProvider: DONamespaceProvider) {
    applyWorkerEnv(globalThisAsAny(), bindings, kvNamespaceProvider, doNamespaceProvider);
    defineGlobalCaches(globalCachesProvider);
    redefineGlobalResponse();
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

function defineGlobalCaches(globalCachesProvider: GlobalCachesProvider) {
    globalThisAsAny()['caches'] = globalCachesProvider();
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

function computeBindingValue(binding: Binding, kvNamespaceProvider: KVNamespaceProvider, doNamespaceProvider: DONamespaceProvider): string | KVNamespace | DurableObjectNamespace {
    if (isTextBinding(binding)) return binding.value;
    if (isSecretBinding(binding)) return binding.secret;
    if (isKVNamespaceBinding(binding)) return kvNamespaceProvider(binding.kvNamespace);
    if (isDONamespaceBinding(binding)) return doNamespaceProvider(binding.doNamespace);
    throw new Error(`TODO implement binding ${JSON.stringify(binding)}`);
}

//

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
