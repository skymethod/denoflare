import { CfCache, CfCacheOptions, CfGlobalCaches } from './cloudflare_workers_types.d.ts';

export class NoopCfGlobalCaches implements CfGlobalCaches {
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

//

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
