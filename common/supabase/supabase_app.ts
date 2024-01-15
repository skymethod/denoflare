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

const SCRIPT_NAME = '${scriptName}';
const scriptNamePrefix = `${SCRIPT_NAME}-`;
const env = Object.fromEntries(Object.entries({ ...Deno.env.toObject(), SCRIPT_NAME }).map(([ name, value ]) => [ name.startsWith(scriptNamePrefix) ? name.substring(scriptNamePrefix.length) : name, value ]));

Deno.serve(async (req) => {
    try {
        if (err) throw new Error(`Failed to import worker module: ${err}`);
        
        const { fetch } = mod;
        if (typeof fetch !== 'function') throw new Error(`Worker module 'fetch' function not found: module keys: ${JSON.stringify(Object.keys(mod))}`);

        const context = {
            waitUntil: (_promise: Promise<unknown>): void => {
                // assumes Supabase waits for all background promises
            }
        };
        const workerReq = new Request(req);
        // deno-lint-ignore no-explicit-any
        (workerReq as any).cf = { colo: env.SB_REGION };
        return await fetch(workerReq, env, context);
    } catch (e) {
        return new Response(`${e.stack || e}`, { status: 500 });
    }
});
