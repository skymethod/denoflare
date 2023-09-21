import { resolve, fromFileUrl, toFileUrl } from 'https://deno.land/std@0.202.0/path/mod.ts'; // intended to be self-contained, don't use shared deps

/**
 * Meant to work properly in a standard Deno environment.
 * Call in the global scope like a standard esm import.
 * 
 * However, when using `denoflare push`, calls to: 
 *   `const text = await importText(import.meta.url, './whatever.txt');`
 *   are rewritten to
 *   `import text from "./relative/path/to/whatever.txt";`
 *   prior to Cloudflare upload, so that it works properly in Cloudflare as well.
 */
export async function importText(importMetaUrl: string, moduleSpecifier: string): Promise<string> {
    if (moduleSpecifier.startsWith('https://')) {
        return await importTextFromHttps(moduleSpecifier);
    }

    if (importMetaUrl.startsWith('file://')) {
        return await (await fetch(appendQueryHint(toFileUrl(resolve(resolve(fromFileUrl(importMetaUrl), '..'), moduleSpecifier))).toString())).text();
    } else if (importMetaUrl.startsWith('https://')) {
        const { pathname, origin } = new URL(importMetaUrl);
        const textUrl = origin + resolve(resolve(pathname, '..'), moduleSpecifier);
        return await importTextFromHttps(textUrl);
    } else {
        throw new Error(`importText: Unsupported importMetaUrl: ${importMetaUrl}`);
    }
}

//

function appendQueryHint(fileUrl: URL): URL {
    fileUrl.searchParams.set('import', 'text');
    return fileUrl;
}

async function importTextFromHttps(url: string): Promise<string> {
    const res = await fetch(url);
    if (res.status !== 200) throw new Error(`importText: Bad status ${res.status}, expected 200 for ${url}`);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.startsWith('text/')) {
        return await res.text();
    } else {
        throw new Error(`importText: Bad contentType ${contentType}, expected text/* for ${url}`);
    }
}
