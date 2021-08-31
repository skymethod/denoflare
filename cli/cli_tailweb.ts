import { basename, dirname, join, fromFileUrl, resolve } from './deps_cli.ts';
import { Bytes } from '../common/bytes.ts';
import { ModuleWatcher } from './module_watcher.ts';
import { CLI_VERSION } from './cli_version.ts';

export async function tailweb(args: (string | number)[], options: Record<string, unknown>) {
    const command = args[0];
    const fn = { build, b64 }[command];
    if (options.help || !fn) {
        dumpHelp();
        return;
    }
    await fn(args.slice(1));
}

//

async function b64(args: (string | number)[]) {
    const path = args[0];
    if (typeof path !== 'string') throw new Error('Must provide path to file');
    const contents = await Deno.readFile(path);
    const b64 = new Bytes(contents).base64();
    console.log(b64);
}

async function build(_args: (string | number)[]) {
    const thisPath = fromFileUrl(import.meta.url);
    const denoflareCliPath = dirname(thisPath);
    const denoflarePath = resolve(denoflareCliPath, '..');
    const tailwebAppPath = join(denoflarePath, 'tailweb-app');
    const tailwebWorkerPath = join(denoflarePath, 'tailweb-worker');
    const appPath = join(tailwebAppPath, 'tailweb_app.ts');
    const dataPath = join(tailwebWorkerPath, 'tailweb_data.ts');

    const regenerateAppContents = async () => {
        console.log(`bundling ${basename(appPath)} into bundle.js...`);
        try {
            const start = Date.now();
            const result = await Deno.emit(appPath, { bundle: 'module', compilerOptions: {
                lib: ['esnext', 'dom'],
            } });
            console.log(`bundle finished in ${Date.now() - start}ms`);
        
            if (result.diagnostics.length > 0) {
                console.warn(Deno.formatDiagnostics(result.diagnostics));
                return;
            }
        
            const scriptContentsStr = result.files['deno:///bundle.js'];
            if (typeof scriptContentsStr !== 'string') throw new Error(`bundle.js not found in bundle output files: ${Object.keys(result.files).join(', ')}`);

            const scriptBytes = Bytes.ofUtf8(scriptContentsStr);
            const scriptBytesSha1 = await scriptBytes.sha1();
            await updateData('TAILWEB_APP_B64', scriptBytes.base64(), dataPath);
            await updateData('TAILWEB_APP_HASH', scriptBytesSha1.hex(), dataPath);
        } catch (e) {
            console.warn('error in regenerateAppContents', e);
        }   
    }

    await regenerateAppContents();
    const _moduleWatcher = new ModuleWatcher(appPath, regenerateAppContents);

    return new Promise((_resolve, _reject) => {

    });
}

async function updateData(name: string, value: string, dataPath: string) {
    const oldText = await Deno.readTextFile(dataPath);
    const newText = oldText.replaceAll(new RegExp(`export const ${name} = '.*?';`, 'g'), `export const ${name} = '${value}';`);
    if (oldText == newText) return;
    await Deno.writeTextFile(dataPath, newText);
    console.log(`Updated ${name}`);
}

function dumpHelp() {
    const lines = [
        `denoflare-tailweb ${CLI_VERSION}`,
        'Tools for developing tailweb - will probably move out of cli at some point',
        '',
        'USAGE:',
        '    denoflare tailweb [FLAGS] [OPTIONS] [--] build',
        '    denoflare tailweb [FLAGS] [OPTIONS] [--] b64 <path>',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'ARGS:',
        '    build         Watch for changes in tailweb-app, and bundle as worker embedded resource',
        '    b64 <path>    Dump out the b64 of a given file',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
