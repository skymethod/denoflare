import { resolve, fromFileUrl, toFileUrl } from 'https://deno.land/std@0.119.0/path/mod.ts'; // intended to be self-contained, don't use shared deps

/**
 * Meant to work properly in a standard Deno environemnt.
 * Call in the global scope like a standard esm import.
 * 
 * However, when using `denoflare push`, calls to: 
 *   `const module = importWasm(import.meta.url, './whatever.wasm');`
 *   are rewritten to
 *   `import module from "./relative/path/to/whatever.wasm";`
 *   prior to Cloudflare upload, so that wasm works properly in Cloudflare as well.
 */
export async function importWasm(importMetaUrl: string, moduleSpecifier: string): Promise<WebAssembly.Module> {
    if (moduleSpecifier.startsWith('https://')) {
        // remote module specifier
        const res = await fetch(moduleSpecifier);
        if (res.status !== 200) throw new Error(`importWasm: Bad status ${res.status}, expected 200 for ${moduleSpecifier}`);
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (contentType === 'application/wasm') {
            const { module } = await WebAssembly.instantiateStreaming(res);
            return module;
        } else if (contentType === 'application/octet-stream') {
            // currently served by https://raw.githubusercontent.com
            // allow it for now
            const { module } = await WebAssembly.instantiate(await res.arrayBuffer());
            return module;
        } else {
            throw new Error(`importWasm: Bad contentType ${contentType}, expected application/wasm or application/octet-stream for ${moduleSpecifier}`);
        }
    }
    // local module specifier
    const { module } = await WebAssembly.instantiateStreaming(await fetch(toFileUrl(resolve(resolve(fromFileUrl(importMetaUrl), '..'), moduleSpecifier)).toString()));
    return module;
}
