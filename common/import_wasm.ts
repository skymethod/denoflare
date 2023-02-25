import { resolve, fromFileUrl, toFileUrl } from 'https://deno.land/std@0.178.0/path/mod.ts'; // intended to be self-contained, don't use shared deps

/**
 * Meant to work properly in a standard Deno environment.
 * Call in the global scope like a standard esm import.
 * 
 * However, when using `denoflare push`, calls to: 
 *   `const module = await importWasm(import.meta.url, './whatever.wasm');`
 *   are rewritten to
 *   `import module from "./relative/path/to/whatever.wasm";`
 *   prior to Cloudflare upload, so that wasm works properly in Cloudflare as well.
 */
export async function importWasm(importMetaUrl: string, moduleSpecifier: string): Promise<WebAssembly.Module> {
    if (moduleSpecifier.startsWith('https://')) {
        return await instantiateModuleFromHttps(moduleSpecifier);
    }

    if (importMetaUrl.startsWith('file://')) {
        return await WebAssembly.compileStreaming(await fetch(appendQueryHint(toFileUrl(resolve(resolve(fromFileUrl(importMetaUrl), '..'), moduleSpecifier))).toString()));
    } else if (importMetaUrl.startsWith('https://')) {
        const { pathname, origin } = new URL(importMetaUrl);
        const wasmUrl = origin + resolve(resolve(pathname, '..'), moduleSpecifier);
        return await instantiateModuleFromHttps(wasmUrl);
    } else {
        throw new Error(`importWasm: Unsupported importMetaUrl: ${importMetaUrl}`);
    }
}

//

function appendQueryHint(fileUrl: URL): URL {
    fileUrl.searchParams.set('import', 'wasm');
    return fileUrl;
}

async function instantiateModuleFromHttps(url: string): Promise<WebAssembly.Module> {
    const res = await fetch(url);
    if (res.status !== 200) throw new Error(`importWasm: Bad status ${res.status}, expected 200 for ${url}`);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType === 'application/wasm') {
        return await WebAssembly.compileStreaming(res);
    } else if (contentType === 'application/octet-stream') {
        // currently served by https://raw.githubusercontent.com
        // allow it for now
        return new WebAssembly.Module(await res.arrayBuffer());
    } else {
        throw new Error(`importWasm: Bad contentType ${contentType}, expected application/wasm or application/octet-stream for ${url}`);
    }
}
