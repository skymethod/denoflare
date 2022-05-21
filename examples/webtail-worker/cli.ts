import { basename, dirname, join, fromFileUrl, resolve, ModuleWatcher, Bytes, parseFlags, bundle } from './deps_cli.ts';

const args = parseFlags(Deno.args);

if (args._.length > 0) {
    await webtail(args._, args);
    Deno.exit(0);
}

dumpHelp();

Deno.exit(1);

//

async function webtail(args: (string | number)[], options: Record<string, unknown>) {
    const command = args[0];
    const fn = { build, b64 }[command];
    if (options.help || !fn) {
        dumpHelp();
        return;
    }
    await fn(args.slice(1));
}

async function b64(args: (string | number)[]) {
    const path = args[0];
    if (typeof path !== 'string') throw new Error('Must provide path to file');
    const contents = await Deno.readFile(path);
    const b64 = new Bytes(contents).base64();
    console.log(b64);
}

async function build(_args: (string | number)[]) {
    const thisPath = fromFileUrl(import.meta.url);
    const webtailWorkerPath = dirname(thisPath);
    const webtailAppPath = resolve(webtailWorkerPath, '../webtail-app');
    const appPath = join(webtailAppPath, 'webtail_app.ts');
    const dataPath = join(webtailWorkerPath, 'webtail_data.ts');

    const regenerateAppContents = async () => {
        console.log(`bundling ${basename(appPath)} into bundle.js...`);
        try {
            const start = Date.now();
            const { code: scriptContentsStr } = await bundle(appPath, { compilerOptions: {
                lib: ['esnext', 'dom'],
            } });
            console.log(`bundle finished in ${Date.now() - start}ms`);

            const scriptBytes = Bytes.ofUtf8(scriptContentsStr);
            const scriptBytesSha1 = await scriptBytes.sha1();
            await updateData('WEBTAIL_APP_B64', scriptBytes.base64(), dataPath);
            await updateData('WEBTAIL_APP_HASH', scriptBytesSha1.hex(), dataPath);
        } catch (e) {
            console.warn('error in regenerateAppContents', e.stack || e);
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
        `webtail-cli`,
        'Tools for developing webtail',
        '',
        'USAGE:',
        '    deno run --unstable --allow-net examples/webtail-worker/cli.ts [FLAGS] [OPTIONS] [--] build',
        '    deno run --unstable --allow-net --allow-read examples/webtail-worker/cli.ts [FLAGS] [OPTIONS] [--] b64 <path>',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'ARGS:',
        '    build         Watch for changes in webtail-app, and bundle as worker embedded resource',
        '    b64 <path>    Dump out the b64 of a given file',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
