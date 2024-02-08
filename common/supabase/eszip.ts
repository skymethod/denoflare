import { build, Parser } from 'https://deno.land/x/eszip@v0.57.0/mod.ts';
import { compress } from 'https://deno.land/x/brotli@0.1.7/mod.ts';
import { concat } from 'https://deno.land/std@0.215.0/bytes/concat.ts';

export async function buildEszip(roots: string[], contentFn: (spec: string) => Promise<string | undefined> | string | undefined): Promise<Uint8Array> {
    return await build(roots, async specifier => {
        const content = await contentFn(specifier);
        if (content) {
            return {
                kind: 'module',
                content,
                specifier,
            };
        }
        return undefined;
    });
}

export type EszipEntry = { specifier: string, source: string, sourceMap?: string };

export async function parseEszip(bytes: Uint8Array): Promise<readonly EszipEntry[]> {
    const parser = await Parser.createInstance();
    const rt: EszipEntry[] = [];
    try {
        const specifiers = await parser.parseBytes(bytes) as string[];
        await parser.load();
        for (const specifier of specifiers) {
            const source = await parser.getModuleSource(specifier) as string;
            const sourceMap = await parser.getModuleSourceMap(specifier) as string | undefined;
            rt.push({ specifier, source, sourceMap });
        }
    } finally {
        parser.free();
    }
    return rt;
}

export function brotliCompressEszip(uncompressedEszip: Uint8Array): Uint8Array {
    const compressed = compress(uncompressedEszip);
    return concat([ new TextEncoder().encode('EZBR'), compressed ]);
}
