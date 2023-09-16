
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
console.log(`${err ? `Failed to import` : 'Successfully imported'} worker module in ${millis}ms`);

Deno.serve(async (req, info) => {
    try {
        if (err) throw new Error(`Failed to import worker module: ${err}`);
        
        const { fetch } = mod;
        if (typeof fetch !== 'function') throw new Error(`Worker module 'fetch' function not found: module keys: ${JSON.stringify(Object.keys(mod))}`);

        const headers = new Headers([...req.headers, [ 'cf-connecting-ip', info.remoteAddr.hostname ] ]);

        const env = Deno.env.toObject();

        return await fetch(new Request(req, { headers }), env);
    } catch (e) {
        return new Response(`${e.stack || e}`, { status: 500 });
    }
});
