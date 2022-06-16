import { bundle } from '../cli/bundle.ts';
import { fromFileUrl, resolve, basename } from './deps.ts';
import { transform, stop } from 'https://deno.land/x/esbuild@v0.14.43/mod.js';
import { parseOptionalBooleanOption } from '../cli/cli_common.ts';
import { runTsc } from './tsc.ts';
import { Bytes } from '../common/bytes.ts';

export async function generateNpm(_args: (string | number)[], options: Record<string, unknown>) {
    const verbose = parseOptionalBooleanOption('verbose', options);
    try {
        await generateEsmMainJs();
        await generateCjsMainJs();
        await generateMainTypes({ verbose });
    } finally {
        stop(); // otherwise esbuild hangs
    }
}

//

async function generateEsmMainJs() {
    const contents = await generateBundleContents({ format: 'esm', target: 'es2019' }); // remove optional chaining for esm too, to support folks using modules, but still on older environments
    const bytes = Bytes.ofUtf8(contents);
    const uncompressedSize = computeBytesString(bytes.length);
    const compressedSize = computeBytesString((await gzip(bytes)).length);
    // unminified: { uncompressedSize: "36.84kb", compressedSize: "8.41kb" }
    // minified:   { uncompressedSize: "21.77kb", compressedSize: "6.85kb" } -1.56kb -23%
    console.log({ uncompressedSize, compressedSize });
    await saveContentsIfChanged('../../npm/denoflare-mqtt/esm/main.js', contents);
}

async function generateCjsMainJs() {
    const contents = (await generateBundleContents({ format: 'cjs', target: 'es2019' })) // remove optional chaining
        .replaceAll(/export { ([A-Z0-9a-z_]+) as ([A-Z0-9a-z_]+) };/g, 'exports.$2 = $1;');
    await saveContentsIfChanged('../../npm/denoflare-mqtt/cjs/main.js', contents);
}

async function generateMainTypes(opts: { verbose?: boolean } = {}) {
    const { verbose = false } = opts;

    // nothing but failure so far
    // https://github.com/denoland/deno_emit/issues/29#issuecomment-1157902613
    
    // use tsc in the meantime

    // const files = [ resolveRelativeFile('../../common/mqtt/mqtt_client.ts'), resolveRelativeFile('../../common/mqtt/mqtt_messages.ts') ];
    const files = [ 'mqtt_client.ts', 'mqtt_messages.ts', 'mqtt_connection.ts' ].map(v => resolveRelativeFile(`../../common/mqtt/${v}`));

    const compilerOptions = {
        declaration: true,
        emitDeclarationOnly: true,
        removeComments: false,
        stripInternal: true,
        lib: [ 'esnext' ],
    };
    const result = await runTsc({ files, compilerOptions });
    if (verbose) console.log(result);
    if (verbose) console.log(result.out);

    const client = result.output['mqtt_client.d.ts'].replaceAll(/import .*?;\n/g, '');
    const messages = result.output['mqtt_messages.d.ts'];
    const connection = result.output['mqtt_connection.d.ts'];

    await saveContentsIfChanged('../../npm/denoflare-mqtt/main.d.ts', [ client, messages, connection ].join('\n\n')); 

    // const tsconfigRaw = JSON.stringify({ compilerOptions2: { emitDeclarationOnly: true, removeComments: false } });
    // console.log(tsconfigRaw);

    // const output = await transform(await Deno.readTextFile(resolveRelativeFile('../../common/mqtt/mqtt_client.ts')), { tsconfigRaw: {  compilerOptions: { }}, loader: 'ts' });
    // console.log(output.code);
    // const tsconfig = await Deno.makeTempFile({ prefix: 'generate-npm-esbuild-tsconfig', suffix: '.json'});
    // await Deno.writeTextFile(tsconfig, JSON.stringify({ compilerOptions2: { emitDeclarationOnly: true, removeComments: false } }));
    // try {
    //     const output = await build({ loader: '', tsconfig: tsconfig, entryPoints: [ resolveRelativeFile('../../common/mqtt/mod_iso.ts')] });
    //     console.log(output);
    // } finally {
    //     await Deno.remove(tsconfig);
    // }
}

async function generateBundleContents(opts: { format: 'cjs' | 'esm', target?: string, minify?: boolean }): Promise<string> {
    const { format, target, minify } = opts;

    const { code } = await bundle(resolveRelativeFile('../../common/mqtt/mod_iso.ts')); // deno bundle does not support 'target' as a compilerOption

    // try to use wasm instead of bundled esbuild binary
    // await initialize({ wasmURL: 'https://unpkg.com/esbuild-wasm@0.14.43/esbuild.wasm' }); // Error: The 'wasmURL' option only works in the browser

    // this doesn't work either
    // https://github.com/evanw/esbuild/issues/2323
    // const wasmModule = await importWasm(import.meta.url, 'https://unpkg.com/esbuild-wasm@0.14.43/esbuild.wasm');
    // console.log({ wasmModule });
    // await initialize({ wasmModule, worker: false }); 

    const { code: code2 } = await transform(code, { format,  target, minify });
    return code2;
}

function resolveRelativeFile(relativePath: string): string {
    return resolve(fromFileUrl(import.meta.url), relativePath);
}

async function saveContentsIfChanged(relativePath: string, contents: string) {
    const outFile = resolveRelativeFile(relativePath);
    const filename = basename(outFile);
    const existing = await tryReadTextFile(outFile);
    if (existing !== contents) {
        console.log(`${filename} changed, saving ${outFile}...`);
        await Deno.writeTextFile(outFile, contents);
        console.log('...saved');
    } else {
        console.log(`${filename} unchanged`);
    }
}

async function tryReadTextFile(path: string): Promise<string | undefined> {
    try {
        return await Deno.readTextFile(path);
    } catch (e) {
        if (e instanceof Deno.errors.NotFound) {
            return undefined;
        }
        throw e;
    }
}

async function gzip(bytes: Bytes): Promise<Bytes> {
    const gzipStream = new Blob([ bytes.array() ]).stream().pipeThrough(new CompressionStream('gzip'));
    return await Bytes.ofStream(gzipStream);
}

function computeBytesString(bytes: number): string {
    if (bytes < 1024) return '';
    let amount = bytes / 1024;
    for (const unit of ['kb', 'mb', 'gb']) {
        if (amount < 1024) return `${MAX_TWO_DECIMALS.format(amount)}${unit}`;
        amount = amount / 1024;
    }
    return `${MAX_TWO_DECIMALS.format(amount)}tb`;    
}

const MAX_TWO_DECIMALS = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
