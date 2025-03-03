const isolateId = crypto.randomUUID().split('-').pop()!;
console.log(`${isolateId}: new isolate`);

const { mod = {}, err, millis } = await (async () => {
    const start = Date.now();
    try {
        const { default: mod } = await import('./worker.ts');
        return { mod, millis: Date.now() - start };
    } catch (e) {
        const err = `${e.stack || e}`;
        return { err, millis: Date.now() - start };
    }
})();
console.log(`${isolateId}: ${err ? `Failed to import` : 'Successfully imported'} worker module in ${millis}ms`);

const env = Deno.env.toObject();

if (mod) {
    const { queue } = mod;
    if (typeof queue === 'function') {
        const kv = await Deno.openKv();
        console.log(`${isolateId}: Queue handler found, listening to queue...`);
        kv.listenQueue(async value => {
            try {
                const id = crypto.randomUUID();
                const batch = { queue: '', messages: [ { id, timestamp: new Date(), body: value, retryAll: () => {
                    // TODO
                } }]};
                await queue(batch);
            } catch (e) {
                console.error(`${isolateId}: Error in queue handler`, e);
            }
        }).catch(e => {
            console.warn(`${isolateId}: listenQueue catch`, e);
        });
    }
}

Deno.serve(async (req, info) => {
    try {
        if (err) throw new Error(`Failed to import worker module: ${err}`);
        
        const { fetch } = mod;
        if (typeof fetch !== 'function') throw new Error(`Worker module 'fetch' function not found: module keys: ${JSON.stringify(Object.keys(mod))}`);

        const headers = new Headers([...req.headers, [ 'cf-connecting-ip', info.remoteAddr.hostname ] ]);

        const kvService = {
            openKv: async (path?: string) => new DenoflareKv(await Deno.openKv(path)),
            newKvU64: (v: bigint) => new Deno.KvU64(v),
            isKvU64: (obj: unknown): obj is Deno.KvU64 => obj instanceof Deno.KvU64,
        }
        const context = {
            kvService,
            waitUntil: (_promise: Promise<unknown>): void => {
                // assumes Deploy waits for all background promises
            },
            upgradeWebSocket: (): Deno.WebSocketUpgrade | undefined => {
                if (req.headers.get('upgrade') !== 'websocket') return undefined;
                return Deno.upgradeWebSocket(req);
            },
        };
        const workerReq = new Request(req, { headers });
        // deno-lint-ignore no-explicit-any
        (workerReq as any).cf = { colo: env.DENO_REGION };
        return await fetch(workerReq, env, context);
    } catch (e) {
        return new Response(`${e.stack || e}`, { status: 500 });
    }
}).finished.catch(e => {
    console.warn(`${isolateId}: serve catch`, e);
});

class DenoflareKv 
// implements Kv
{
    private readonly kv: Deno.Kv;

    constructor(kv: Deno.Kv) {
        this.kv = kv;
    }

    get<T = unknown>(key: Deno.KvKey, options?: { consistency?: Deno.KvConsistencyLevel | undefined; } | undefined): Promise<Deno.KvEntryMaybe<T>> {
        return this.kv.get(key, options);
    }

    getMany<T extends readonly unknown[]>(keys: readonly [...{ [K in keyof T]: Deno.KvKey; }], options?: { consistency?: Deno.KvConsistencyLevel | undefined; } | undefined): Promise<{ [K in keyof T]: Deno.KvEntryMaybe<T[K]>; }> {
        return this.kv.getMany<T>(keys, options);
    }

    set(key: Deno.KvKey, value: unknown, options?: { expireIn?: number | undefined; } | undefined): Promise<Deno.KvCommitResult> {
        return this.kv.set(key, value, options);
    }

    delete(key: Deno.KvKey): Promise<void> {
        return this.kv.delete(key);
    }

    list<T = unknown>(selector: Deno.KvListSelector, options?: Deno.KvListOptions | undefined): Deno.KvListIterator<T> {
        return this.kv.list<T>(selector, options);
    }

    enqueue(value: unknown, options?: { delay?: number | undefined; keysIfUndelivered?: Deno.KvKey[] | undefined; } | undefined): Promise<Deno.KvCommitResult> {
        return this.kv.enqueue(value, options);
    }

    listenQueue(_handler: (value: unknown) => void | Promise<void>): Promise<void> {
        throw new Error(`'listenQueue' not implemented directly, export a module queue handler instead.`);
    }

    atomic(): Deno.AtomicOperation {
        return this.kv.atomic();
    }

    close(): void {
        return this.kv.close();
    }
}
