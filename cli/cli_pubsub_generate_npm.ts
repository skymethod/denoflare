// deno-lint-ignore-file no-explicit-any
import { fromFileUrl, resolve, basename } from './deps_cli.ts';

// Requires Deno 1.21.3 or below (RIP Deno.emit)

export async function generateNpm(_args: (string | number)[], _options: Record<string, unknown>) {
    await generateEsmMainJs();
    await generateCjsMainJs();
    await generateMainTypes();
}

//

async function generateEsmMainJs() {
    const contents = await generateBundleContents({ target: 'es2019' }); // remove optional chaining for esm too, to support folks using modules, but still on older environments
    await saveContentsIfChanged('../../npm/denoflare-mqtt/esm/main.js', contents);
}

async function generateCjsMainJs() {
    const contents = (await generateBundleContents({ target: 'es2019' })) // remove optional chaining
        .replaceAll(/export { ([A-Z0-9a-z_]+) as ([A-Z0-9a-z_]+) };/g, 'exports.$2 = $1;');
    await saveContentsIfChanged('../../npm/denoflare-mqtt/cjs/main.js', contents);
}

async function generateMainTypes() {
    // requires --unstable
    const result = await (Deno as any).emit(resolveRelativeFile('../../common/mqtt/mqtt_client.ts'), { 
        // bundle: 'classic', 
        compilerOptions: { 
            declaration: true, // doesn't work with bundle: module
            emitDeclarationOnly: true,
            removeComments: false,
        },
    });
    const declaration1 = Object.entries(result.files).filter(v => v[0].endsWith('/mqtt_client.ts.d.ts'))[0][1] as string;
    const contents1 = declaration1
        .replaceAll(/\/\/\/ <amd-module name=".*?" \/>\s+/g, '')
        .replaceAll(/\n\s+private .*?;/g, '')
        .replaceAll(/import .*?;\n/g, '')
        ;
    
    const declaration2 = Object.entries(result.files).filter(v => v[0].endsWith('/mqtt_messages.ts.d.ts'))[0][1] as string;
    const contents2 = declaration2
        .replaceAll(/\/\/\/ <amd-module name=".*?" \/>\s+/g, '')
        .replaceAll(/\n\/\*\*\s+@internal1.*?;.*?;/gs, '')
        .replaceAll(/\n\/\*\*\s+@internalclass.*?\n}/gs, '')
        .replaceAll(/\n\/\*\*\s+@internal.*?;/gs, '')
        ;

    await saveContentsIfChanged('../../npm/denoflare-mqtt/main.d.ts', [ contents1, contents2].join('\n\n\n'));
}

async function generateBundleContents(opts: { target?: string }): Promise<string> {
    const { target } = opts;

    // requires --unstable
    const result = await (Deno as any).emit(resolveRelativeFile('../../common/mqtt/mqtt_client.ts'), { 
        bundle: 'module'
    });
    const js = result.files['deno:///bundle.js'];
    if (!target) return js;

    // transpilation
    // https://github.com/denoland/deno/issues/9638#issuecomment-982748670
    const transpiled = await (Deno as any).emit('/src.ts', {
        sources: { '/src.ts': js },
        compilerOptions: { target },
    });
    return transpiled.files['file:///src.ts.js'];
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
