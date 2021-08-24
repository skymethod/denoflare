import { basename, dirname, join, fromFileUrl, resolve } from './deps_cli.ts';
import { Bytes } from '../common/bytes.ts';
import { ModuleWatcher } from './module_watcher.ts';

export async function tailweb(args: (string | number)[], options: Record<string, unknown>) {
    const command = args[0];
    if (options.help || typeof command !== 'string' || command !== 'build') {
        console.log('tailweb help!');
        return;
    }

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

            await updateData('TAILWEB_APP_DATA', 'text/javascript', Bytes.ofUtf8(scriptContentsStr), dataPath);
        } catch (e) {
            console.warn('error in regenerateAppContents', e);
        }   
    }

    await regenerateAppContents();
    const _moduleWatcher = new ModuleWatcher(appPath, regenerateAppContents);

    return new Promise((_resolve, _reject) => {

    });
}

async function updateData(name: string, mimeType: string, bytes: Bytes, dataPath: string) {
    const oldText = await Deno.readTextFile(dataPath);
    const newText = oldText.replaceAll(new RegExp(`export const ${name} = '.*?';`, 'g'), `export const ${name} = 'data:${mimeType};base64,${bytes.base64()}';`);
    if (oldText == newText) return;
    await Deno.writeTextFile(dataPath, newText);
    console.log('Regenerated app data');
}
