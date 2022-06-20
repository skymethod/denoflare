import { Binding, isAnalyticsEngineBinding, isDONamespaceBinding, isKVNamespaceBinding, isR2BucketBinding, isSecretBinding, isTextBinding } from './config.ts';
import { KVNamespace, DurableObjectNamespace, CfGlobalCaches, CloudflareWebSocketExtensions, WebSocketPair, R2Bucket, AnalyticsEngine } from './cloudflare_workers_types.d.ts';
import { DenoflareResponse } from './denoflare_response.ts';

export type GlobalCachesProvider = () => CfGlobalCaches;
export type KVNamespaceProvider = (kvNamespace: string) => KVNamespace;
export type DONamespaceProvider = (doNamespace: string) => DurableObjectNamespace;
export type R2BucketProvider = (bucketName: string) => R2Bucket;
export type AnalyticsEngineProvider = (dataset: string) => AnalyticsEngine;
export type WebSocketPairProvider = () => { server: WebSocket & CloudflareWebSocketExtensions, client: WebSocket };

export function defineModuleGlobals(globalCachesProvider: GlobalCachesProvider, webSocketPairProvider: WebSocketPairProvider) {
    defineGlobalCaches(globalCachesProvider);
    defineGlobalWebsocketPair(webSocketPairProvider);
    redefineGlobalResponse();
    patchGlobalRequest();
}

export function applyWorkerEnv(target: Record<string, unknown>, bindings: Record<string, Binding>, kvNamespaceProvider: KVNamespaceProvider, doNamespaceProvider: DONamespaceProvider, r2BucketProvider: R2BucketProvider, analyticsEngineProvider: AnalyticsEngineProvider) {
    for (const [ name, binding ] of Object.entries(bindings)) {
        target[name] = computeBindingValue(binding, kvNamespaceProvider, doNamespaceProvider, r2BucketProvider, analyticsEngineProvider);
    }
}

export function defineScriptGlobals(bindings: Record<string, Binding>, globalCachesProvider: GlobalCachesProvider, kvNamespaceProvider: KVNamespaceProvider, doNamespaceProvider: DONamespaceProvider, r2BucketProvider: R2BucketProvider, analyticsEngineProvider: AnalyticsEngineProvider) {
    applyWorkerEnv(globalThisAsAny(), bindings, kvNamespaceProvider, doNamespaceProvider, r2BucketProvider, analyticsEngineProvider);
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

function computeBindingValue(binding: Binding, kvNamespaceProvider: KVNamespaceProvider, doNamespaceProvider: DONamespaceProvider, r2BucketProvider: R2BucketProvider, analyticsEngineProvider: AnalyticsEngineProvider): string | KVNamespace | DurableObjectNamespace | R2Bucket | AnalyticsEngine {
    if (isTextBinding(binding)) return binding.value;
    if (isSecretBinding(binding)) return binding.secret;
    if (isKVNamespaceBinding(binding)) return kvNamespaceProvider(binding.kvNamespace);
    if (isDONamespaceBinding(binding)) return doNamespaceProvider(binding.doNamespace);
    if (isR2BucketBinding(binding)) return r2BucketProvider(binding.bucketName);
    if (isAnalyticsEngineBinding(binding)) return analyticsEngineProvider(binding.dataset);
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
