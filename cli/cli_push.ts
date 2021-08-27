import { loadConfig, resolveCredential } from './config_loader.ts';
import { basename, extname, gzip } from './deps_cli.ts';
import { putScript } from '../common/cloudflare_api.ts';
import { CLI_VERSION } from './cli_version.ts';
import { Config } from '../common/config.ts';
import { Bytes } from '../common/bytes.ts';

export async function push(args: (string | number)[], options: Record<string, unknown>) {
    const scriptReference = args[0];
    if (options.help || typeof scriptReference !== 'string') {
        dumpHelp();
        return;
    }
    const nameFromOptions = typeof options.name === 'string' && options.name.trim().length > 0 ? options.name.trim() : undefined;

    const config = await loadConfig();
    const { scriptName, rootSpecifier } = computeContentsForScriptReference(scriptReference, config, nameFromOptions);
    const { accountId, apiToken } = await resolveCredential(config);
    
    console.log(`bundling ${scriptName} into bundle.js...`);
    let start = Date.now();
    const result = await Deno.emit(rootSpecifier, { bundle: 'module' });
    console.log(`bundle finished in ${Date.now() - start}ms`);

    if (result.diagnostics.length > 0) {
        console.warn(Deno.formatDiagnostics(result.diagnostics));
        throw new Error('bundle failed');
    }

    const scriptContentsStr = result.files['deno:///bundle.js'];
    if (typeof scriptContentsStr !== 'string') throw new Error(`bundle.js not found in bundle output files: ${Object.keys(result.files).join(', ')}`);
    const scriptContents = new TextEncoder().encode(scriptContentsStr);
    const compressedScriptContents = gzip(scriptContents);

    console.log(`putting script ${scriptName}... (${Bytes.formatSize(scriptContents.length)}) (${Bytes.formatSize(compressedScriptContents.length)} compressed)`);
    start = Date.now();
    await putScript(accountId, scriptName, scriptContents, [], apiToken);
    console.log(`put script ${scriptName} in ${Date.now() - start}ms`);
}

//

function computeContentsForScriptReference(scriptReference: string, config: Config, nameFromOptions?: string): { scriptName: string, rootSpecifier: string } {
    if (scriptReference.startsWith('https://')) {
        const base = basename(scriptReference);
        const ext = extname(scriptReference);
        const scriptName = nameFromOptions || (base.endsWith(ext) ? base.substring(0, base.length - ext.length) : base);
        const rootSpecifier = scriptReference;
        return { scriptName, rootSpecifier };
    } else {
        const script = config.scripts[scriptReference];
        if (script === undefined) throw new Error(`Script '${scriptReference}' not found in config`);
        const scriptName = nameFromOptions || scriptReference;
        const rootSpecifier = script.path;
        return { scriptName, rootSpecifier };
    }
}

function dumpHelp() {
    const lines = [
        `denoflare-push ${CLI_VERSION}`,
        'Upload a worker script to Cloudflare Workers',
        '',
        'USAGE:',
        '    denoflare push [FLAGS] [OPTIONS] [--] [script-reference]',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'OPTIONS:',
        '    -n, --name <name>     Name to use for Cloudflare Worker script [default: Name of script defined in .denoflare config, or https url basename sans extension]',
        '',
        'ARGS:',
        '    <script-reference>    Name of script defined in .denoflare config, or an https url to a module-based worker .ts, e.g. https://path/to/worker.ts',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
