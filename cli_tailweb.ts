import { basename, dirname, join, fromFileUrl } from 'https://deno.land/std@0.105.0/path/mod.ts';
import { Bytes } from './bytes.ts';
import { ModuleWatcher } from './module_watcher.ts';

export async function tailweb(args: (string | number)[], options: Record<string, unknown>) {
    const command = args[0];
    if (options.help || typeof command !== 'string' || command !== 'build') {
        console.log('tailweb help!');
        return;
    }

    const thisPath = fromFileUrl(import.meta.url);
    const denoflarePath = dirname(thisPath);
    const tailwebPath = join(denoflarePath, 'tailweb');
    const appPath = join(tailwebPath, 'tailweb_app.ts');
    const dataPath = join(tailwebPath, 'tailweb_data.ts');

    const regenerateAppContents = async () => {
        console.log(`bundling ${basename(appPath)} into bundle.js...`);
        const start = Date.now();
        const result = await Deno.emit(appPath, { bundle: 'module' });
        console.log(`bundle finished in ${Date.now() - start}ms`);
    
        if (result.diagnostics.length > 0) {
            console.warn(Deno.formatDiagnostics(result.diagnostics));
            throw new Error('bundle failed');
        }
    
        const scriptContentsStr = result.files['deno:///bundle.js'];
        if (typeof scriptContentsStr !== 'string') throw new Error(`bundle.js not found in bundle output files: ${Object.keys(result.files).join(', ')}`);

        await updateData('TAILWEB_APP_DATA', 'text/javascript', Bytes.ofUtf8(scriptContentsStr), dataPath);
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
