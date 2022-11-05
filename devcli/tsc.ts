import { walk } from 'https://deno.land/std@0.162.0/fs/mod.ts'; // isolated for sharing
import { spawn } from '../cli/spawn.ts';

export type TscResult = { code: number, success: boolean, out: string, err: string, output: Record<string, string> };

export async function runTsc(opts: { files: string[], compilerOptions: Record<string, unknown>, tscPath?: string }): Promise<TscResult> {
    const { files, compilerOptions, tscPath = '/usr/local/bin/tsc' } = opts;
    const tsconfigFile = await Deno.makeTempFile({ prefix: 'run-tsc-tsconfig', suffix: '.json'});
    const outDir = await Deno.makeTempDir({ prefix: 'run-tsc-outdir', suffix: '.json'});
    compilerOptions.outDir = outDir;
    try {
        await Deno.writeTextFile(tsconfigFile, JSON.stringify({ files, compilerOptions }, undefined, 2));
        const { code, success, stdout, stderr } = await spawn(tscPath, {
            args: [
                '--project', tsconfigFile,
            ],
            env: {
                NO_COLOR: '1', // to make parsing the output easier
            }
        });
        const out = new TextDecoder().decode(stdout);
        const err = new TextDecoder().decode(stderr);
        const output: Record<string, string> = {};
        for await (const entry of walk(outDir, { maxDepth: 1 })) {
            if (!entry.isFile) continue;
            const { name, path } = entry;
            output[name] = await Deno.readTextFile(path);
        }
        return { code, success, out, err, output };
    } finally {
        await Deno.remove(tsconfigFile);
        await Deno.remove(outDir, { recursive: true });
    }
}
