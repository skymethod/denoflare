import { loadConfig, resolveProfile } from './config_loader.ts';
import { gzip } from './deps_cli.ts';
import { putScript } from '../common/cloudflare_api.ts';
import { CLI_VERSION } from './cli_version.ts';
import { Bytes } from '../common/bytes.ts';
import { isValidScriptName } from '../common/config_validation.ts';
import { computeContentsForScriptReference } from './cli_common.ts';

export async function push(args: (string | number)[], options: Record<string, unknown>) {
    const scriptSpec = args[0];
    if (options.help || typeof scriptSpec !== 'string') {
        dumpHelp();
        return;
    }
    const nameFromOptions = typeof options.name === 'string' && options.name.trim().length > 0 ? options.name.trim() : undefined;

    const config = await loadConfig(options);
    const { scriptName, rootSpecifier } = await computeContentsForScriptReference(scriptSpec, config, nameFromOptions);
    if (!isValidScriptName(scriptName)) throw new Error(`Bad scriptName: ${scriptName}`);
    const { accountId, apiToken } = await resolveProfile(config, options);
    
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

function dumpHelp() {
    const lines = [
        `denoflare-push ${CLI_VERSION}`,
        'Upload a worker script to Cloudflare Workers',
        '',
        'USAGE:',
        '    denoflare push [FLAGS] [OPTIONS] [--] [script-spec]',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'OPTIONS:',
        '    -n, --name <name>        Name to use for Cloudflare Worker script [default: Name of script defined in .denoflare config, or https url basename sans extension]',
        '        --profile <name>     Name of profile to load from config (default: only profile or default profile in config)',
        '        --config <path>      Path to config file (default: .denoflare in cwd or parents)',
        '',
        'ARGS:',
        '    <script-spec>    Name of script defined in .denoflare config, file path to bundled js worker, or an https url to a module-based worker .ts, e.g. https://path/to/worker.ts',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
