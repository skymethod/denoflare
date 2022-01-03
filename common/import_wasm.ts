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
    const { module } = await WebAssembly.instantiateStreaming(await fetch(toFileUrl(resolve(resolve(fromFileUrl(importMetaUrl), '..'), moduleSpecifier))));
    return module;
}
