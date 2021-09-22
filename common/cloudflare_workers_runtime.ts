import { Binding, isDONamespaceBinding, isKVNamespaceBinding, isSecretBinding, isTextBinding } from './config.ts';
import { KVNamespace, DurableObjectNamespace, CfGlobalCaches, CloudflareWebSocketExtensions, WebSocketPair } from './cloudflare_workers_types.d.ts';
import { DenoflareResponse } from './denoflare_response.ts';

export type GlobalCachesProvider = () => CfGlobalCaches;
export type KVNamespaceProvider = (kvNamespace: string) => KVNamespace;
export type DONamespaceProvider = (doNamespace: string) => DurableObjectNamespace;
export type WebSocketPairProvider = () => { server: WebSocket & CloudflareWebSocketExtensions, client: WebSocket };

export function defineModuleGlobals(globalCachesProvider: GlobalCachesProvider, webSocketPairProvider: WebSocketPairProvider) {
    defineGlobalCaches(globalCachesProvider);
    defineGlobalWebsocketPair(webSocketPairProvider);
    redefineGlobalResponse();
    patchGlobalRequest();
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
    patchGlobalRequest();
}

//

function defineGlobalCaches(globalCachesProvider: GlobalCachesProvider) {
    globalThisAsAny()['caches'] = globalCachesProvider();
}

function redefineGlobalResponse() {
    globalThisAsAny()['Response'] = DenoflareResponse;
}

const _clone = Request.prototype.clone;

function patchGlobalRequest() {
    // clone the non-standard .cf property as well
    Request.prototype.clone = function() {
        const rt = _clone.bind(this)();
        // deno-lint-ignore no-explicit-any
        (rt as any).cf = structuredClone((this as any).cf);
        return rt;
    }
}

function defineGlobalWebsocketPair(webSocketPairProvider: WebSocketPairProvider) {
    DenoflareWebSocketPair.provider = webSocketPairProvider;
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
    static provider: WebSocketPairProvider = () => { throw new Error(`DenoflareWebSocketPair: no provider set`); };

    readonly 0: WebSocket; // client, returned in the ResponseInit
    readonly 1: WebSocket & CloudflareWebSocketExtensions; // server, accept(), addEventListener(), send() and close()

    constructor() {
        const { server, client } = DenoflareWebSocketPair.provider();
        this['0'] = client;
        this['1'] = server;
    }
}
