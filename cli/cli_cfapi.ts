import { loadConfig, resolveProfile } from './config_loader.ts';
import { CLI_VERSION } from './cli_version.ts';
import { CloudflareApi, getWorkerAccountSettings, putWorkerAccountSettings } from '../common/cloudflare_api.ts';

export async function cfapi(args: (string | number)[], options: Record<string, unknown>) {
    const apiCommand = args[0];
    if (options.help || typeof apiCommand !== 'string') {
        dumpHelp();
        return;
    }

    const config = await loadConfig(options);
    const { accountId, apiToken } = await resolveProfile(config, options);
    if (options.verbose) CloudflareApi.DEBUG = true;
    if (apiCommand === 'get-worker-account-settings') {
        const settings = await getWorkerAccountSettings(accountId, apiToken);
        console.log(settings);
    } else if (apiCommand === 'put-worker-account-settings') {
        const defaultUsageModel = options['default-usage-model'];
        if (defaultUsageModel !== 'bundled' && defaultUsageModel !== 'unbound') throw new Error(`Bad --default-usage-model: ${defaultUsageModel}, expected bundled or unbound`);
        const success = await putWorkerAccountSettings(accountId, apiToken, { defaultUsageModel });
        console.log(success);
    } else {
        dumpHelp();
    }
}

//

function dumpHelp() {
    const lines = [
        `denoflare-cfapi ${CLI_VERSION}`,
        'Call the Cloudflare REST API',
        '',
        'USAGE:',
        '    denoflare cfapi [api-command] [FLAGS] [OPTIONS]',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'OPTIONS:',
        '        --profile <name>       Name of profile to load from config (default: only profile or default profile in config)',
        '        --config <path>        Path to config file (default: .denoflare in cwd or parents)',
        '',
        'ARGS:',
        '        <api-command>          get-worker-account-settings',
        '                               put-worker-account-settings --default-usage-model <bundled | unbound>',

    ];
    for (const line of lines) {
        console.log(line);
    }
}
