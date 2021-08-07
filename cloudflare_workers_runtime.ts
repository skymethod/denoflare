import { Binding, isDONamespaceBinding, isKVNamespaceBinding, isSecretBinding, isTextBinding } from './config.ts';
import { KVNamespace, DurableObjectNamespace, CfCache, CfCacheOptions, CfGlobalCaches } from './deps_cf.ts';
import { consoleWarn } from './console.ts';

export function defineModuleGlobals() {
    defineGlobalCaches();
    redefineGlobalFetch();
}

export function applyWorkerEnv(target: Record<string, unknown>, bindings: Record<string, Binding>, kvNamespaceResolver: (kvNamespace: string) => KVNamespace, doNamespaceResolver: (doNamespace: string) => DurableObjectNamespace) {
    for (const [ name, binding ] of Object.entries(bindings)) {
        target[name] = computeBindingValue(binding, kvNamespaceResolver, doNamespaceResolver);
    }
}

export function defineScriptGlobals(bindings: Record<string, Binding>, kvNamespaceResolver: (kvNamespace: string) => KVNamespace, doNamespaceResolver: (doNamespace: string) => DurableObjectNamespace) {
    applyWorkerEnv(globalThisAsAny(), bindings, kvNamespaceResolver, doNamespaceResolver);
    defineGlobalCaches();
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
    const caches: CfGlobalCaches = { default: new NoopCfCache() };
    globalThisAsAny()['caches'] = caches;
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

class NoopCfCache implements CfCache {

    put(_request: string | Request, _response: Response): Promise<undefined> {
        return Promise.resolve(undefined);
    }
    
    match(_request: string | Request, _options?: CfCacheOptions): Promise<Response|undefined> {
        return Promise.resolve(undefined);
    }

    delete(_request: string | Request, _options?: CfCacheOptions): Promise<boolean> {
        return Promise.resolve(false);
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
