import { DurableObjectStorage } from '../common/cloudflare_workers_types.d.ts';
import { LocalDurableObjects } from '../common/local_durable_objects.ts';
import { RpcChannel } from '../common/rpc_channel.ts';
import { Delete1, Delete2, DeleteAll, DurableObjectStorageReference, Get1, Get2, List, Put1, Put2, SqliteDbPath, Sync } from '../common/rpc_stub_durable_object_storage.ts';
import { sqliteDbPathForInstance } from './sqlite_dbpath_for_instance.ts';

export function makeRpcHostDurableObjectStorage(channel: RpcChannel) {
    const cache = new Map<string, DurableObjectStorage>();
    channel.addRequestHandler('do-storage', async data => {
        if (typeof data === 'object') {
            if (typeof data.method === 'string') {
                const { method } = data;
                if (method === 'get1') {
                    const { reference, key, opts } = data as Get1;
                    try {
                        const storage = await locateStorage(reference, cache);
                        const value = await storage.get(key, opts);
                        return { value };
                    } catch (e) {
                        return { error: `${e}`};
                    }
                } else if (method === 'get2') {
                    const { reference, keys, opts } = data as Get2;
                    try {
                        const storage = await locateStorage(reference, cache);
                        const value = await storage.get(keys, opts);
                        return { value };
                    } catch (e) {
                        return { error: `${e}`};
                    }
                } else if (method === 'put1') {
                    const { reference, key, value, opts } = data as Put1;
                    try {
                        const storage = await locateStorage(reference, cache);
                        await storage.put(key, value, opts);
                        return { };
                    } catch (e) {
                        return { error: `${e}`};
                    }
                } else if (method === 'put2') {
                    const { reference, entries, opts } = data as Put2;
                    try {
                        const storage = await locateStorage(reference, cache);
                        await storage.put(entries, opts);
                        return { };
                    } catch (e) {
                        return { error: `${e}`};
                    }
                } else if (method === 'delete-all') {
                    const { reference } = data as DeleteAll;
                    try {
                        const storage = await locateStorage(reference, cache);
                        await storage.deleteAll();
                        return { };
                    } catch (e) {
                        return { error: `${e}`};
                    }
                } else if (method === 'sync') {
                    const { reference } = data as Sync;
                    try {
                        const storage = await locateStorage(reference, cache);
                        await storage.sync();
                        return { };
                    } catch (e) {
                        return { error: `${e}`};
                    }
                } else if (method === 'list') {
                    const { reference, options } = data as List;
                    try {
                        const storage = await locateStorage(reference, cache);
                        const value = await storage.list(options);
                        return { value };
                    } catch (e) {
                        return { error: `${e}`};
                    }
                } else if (method === 'delete1') {
                    const { reference, key, opts } = data as Delete1;
                    try {
                        const storage = await locateStorage(reference, cache);
                        const value = await storage.delete(key, opts);
                        return { value };
                    } catch (e) {
                        return { error: `${e}`};
                    }
                } else if (method === 'delete2') {
                    const { reference, keys, opts } = data as Delete2;
                    try {
                        const storage = await locateStorage(reference, cache);
                        const value = await storage.delete(keys, opts);
                        return { value };
                    } catch (e) {
                        return { error: `${e}`};
                    }
                } else if (method === 'sqlite-db-path') {
                    const { container, className, id } = data as SqliteDbPath;
                    try {
                        const value = await sqliteDbPathForInstance({ container, className, id });
                        return { value };
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

async function locateStorage(reference: DurableObjectStorageReference, cache: Map<string, DurableObjectStorage>): Promise<DurableObjectStorage> {
    const { className, id, options } = reference;
    const optionsKey = Object.keys(options).sort().map(v => `${v}=${options[v]}`).join(',');
    const cacheKey = `${optionsKey}:${className}:${id.toString()}`;
    let storage = cache.get(cacheKey);
    if (!storage) {
        const dispatchAlarm = () => {
            // TODO implement
            console.log(`RpcHostDurableObjectStorage: dispatchAlarm`, { className, id });
        }
        storage = await LocalDurableObjects.newDurableObjectStorage(className, id, options, dispatchAlarm);
        console.log(`RpcHostDurableObjectStorage: created: ${cacheKey} -> ${storage}`);
        cache.set(cacheKey, storage);
    }
    return storage;
}
