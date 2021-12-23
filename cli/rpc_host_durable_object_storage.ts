import { DurableObjectStorage } from '../common/cloudflare_workers_types.d.ts';
import { localDurableObjectStorageProvider } from '../common/local_durable_objects.ts';
import { RpcChannel } from '../common/rpc_channel.ts';
import { DurableObjectStorageReference, Get1, Put1 } from '../common/rpc_durable_object_storage.ts';

export function makeRpcHostDurableObjectStorage(channel: RpcChannel) {
    const cache = new Map<string, DurableObjectStorage>();
    channel.addRequestHandler('do-storage', async data => {
        if (typeof data === 'object') {
            if (typeof data.method === 'string') {
                const { method } = data;
                if (method === 'get1') {
                    const { reference, key, opts } = data as Get1;
                    try {
                        const storage = locateStorage(reference, cache);
                        const value = await storage.get(key, opts);
                        return { value };
                    } catch (e) {
                        return { error: `${e}`};
                    }
                } else if (method === 'put1') {
                    const { reference, key, value, opts } = data as Put1;
                    try {
                        const storage = locateStorage(reference, cache);
                        await storage.put(key, value, opts);
                        return { };
                    } catch (e) {
                        return { error: `${e}`};
                    }
                } else {
                    throw new Error(`RpcHostDurableObjectStorage: unsupported method: ${method}`);
                }
            }
        }
    });
}

//

function locateStorage(reference: DurableObjectStorageReference, cache: Map<string, DurableObjectStorage>): DurableObjectStorage {
    const { className, id, options } = reference;
    const optionsKey = Object.keys(options).sort().map(v => `${v}=${options[v]}`).join(',');
    const cacheKey = `${optionsKey}:${className}:${id.toString()}`;
    let storage = cache.get(cacheKey);
    if (!storage) {
        storage = localDurableObjectStorageProvider(className, id, options);
        console.log(`RpcHostDurableObjectStorage: created: ${cacheKey} -> ${storage}`);
        cache.set(cacheKey, storage);
    }
    return storage;
}
