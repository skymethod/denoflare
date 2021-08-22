import { loadConfig, resolveCredential } from './config_loader.ts';
import { basename } from 'https://deno.land/std@0.105.0/path/mod.ts';
import { putScript } from './cloudflare_api.ts';

export async function push(args: (string | number)[], options: Record<string, unknown>) {
    const scriptName = args[0];
    if (options.help || typeof scriptName !== 'string') {
        console.log('push help!');
        return;
    }

    const config = await loadConfig();
    const script = config.scripts[scriptName];
    if (script === undefined) throw new Error(`Script '${scriptName}' not found`);

    const { accountId, apiToken } = await resolveCredential(config);
    
    console.log(`bundling ${basename(script.path)} into bundle.js...`);
    let start = Date.now();
    const result = await Deno.emit(script.path, { bundle: 'module' });
    console.log(`bundle finished in ${Date.now() - start}ms`);

    if (result.diagnostics.length > 0) {
        console.warn(Deno.formatDiagnostics(result.diagnostics));
        throw new Error('bundle failed');
    }

    const scriptContentsStr = result.files['deno:///bundle.js'];
    if (typeof scriptContentsStr !== 'string') throw new Error(`bundle.js not found in bundle output files: ${Object.keys(result.files).join(', ')}`);
    const scriptContents = new TextEncoder().encode(scriptContentsStr);

    console.log(`putting script ${scriptName}...`);
    start = Date.now();
    await putScript(accountId, scriptName, scriptContents, [], apiToken);
    console.log(`put script ${scriptName} in ${Date.now() - start}ms`);
}
