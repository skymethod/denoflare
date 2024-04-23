import { resolve, fromFileUrl, toFileUrl } from 'https://deno.land/std@0.223.0/path/mod.ts'; // intended to be self-contained, don't use shared deps

/**
 * Meant to work properly in a standard Deno environment.
 * Call in the global scope like a standard esm import.
 * 
 * However, when using `denoflare push`, calls to: 
 *   `const buffer = await importBinary(import.meta.url, './whatever.png');`
 *   are rewritten to
 *   `import buffer from "./relative/path/to/whatever.png";`
 *   prior to Cloudflare upload, so that it works properly in Cloudflare as well.
 */
export async function importBinary(importMetaUrl: string, moduleSpecifier: string, fetcher: (url: string) => Promise<Response> = fetch): Promise<ArrayBuffer> {
    if (moduleSpecifier.startsWith('https://')) {
        return await importBinaryFromHttps(moduleSpecifier, fetcher);
    }

    if (importMetaUrl.startsWith('file://')) {
        return await (await fetcher(appendQueryHint(toFileUrl(resolve(resolve(fromFileUrl(importMetaUrl), '..'), moduleSpecifier))).toString())).arrayBuffer();
    } else if (importMetaUrl.startsWith('https://')) {
        const { pathname, origin } = new URL(importMetaUrl);
        const binaryUrl = origin + resolve(resolve(pathname, '..'), moduleSpecifier);
        return await importBinaryFromHttps(binaryUrl, fetcher);
    } else {
        throw new Error(`importBinary: Unsupported importMetaUrl: ${importMetaUrl}`);
    }
}

//

function appendQueryHint(fileUrl: URL): URL {
    fileUrl.searchParams.set('import', 'binary');
    return fileUrl;
}

async function importBinaryFromHttps(url: string, fetcher: (url: string) => Promise<Response>): Promise<ArrayBuffer> {
    const res = await fetcher(url);
    if (res.status !== 200) throw new Error(`importBinary: Bad status ${res.status}, expected 200 for ${url}`);
    // no content-type check for binary files
    return await res.arrayBuffer();
}
