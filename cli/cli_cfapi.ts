import { loadConfig, resolveProfile } from './config_loader.ts';
import { CLI_VERSION } from './cli_version.ts';
import { CloudflareApi, getKeyMetadata, getKeyValue, getWorkerAccountSettings, putKeyValue, putWorkerAccountSettings } from '../common/cloudflare_api.ts';
import { check } from '../common/check.ts';
import { Bytes } from '../common/bytes.ts';

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
    } else if (apiCommand === 'put-key-value') {
        const [ _, namespaceId, key ] = args;
        check('namespaceId', namespaceId, typeof namespaceId === 'string');
        check('key', key, typeof key === 'string');
        const value = await (async () => {
            const { value, file } = options;
            if (typeof value === 'string') return value;
            if (typeof file === 'string') return await Deno.readTextFile(file);
            throw new Error(`Provide 'value' or 'file' options for the key value.`);
        })();
        check('value', value, typeof value === 'string');
        const { expiration, 'expiration-ttl': expirationTtl, metadata } = options;
        check('expiration', expiration, expiration === undefined || typeof expiration === 'number');
        check('expirationTtl', expirationTtl, expirationTtl === undefined || typeof expirationTtl === 'number');
        check('metadata', metadata, metadata === undefined || typeof metadata === 'string');
        await putKeyValue(accountId, namespaceId, key, value, apiToken, { expiration, expirationTtl, metadata: metadata ? JSON.parse(metadata) : undefined });
    } else if (apiCommand === 'get-key-value') {
        const [ _, namespaceId, key ] = args;
        check('namespaceId', namespaceId, typeof namespaceId === 'string');
        check('key', key, typeof key === 'string');
        const value = await getKeyValue(accountId, namespaceId, key, apiToken);
        console.log(value ? new Bytes(value).utf8() : value);
        if (options.metadata) {
            const metadata = await getKeyMetadata(accountId, namespaceId, key, apiToken);
            console.log(JSON.stringify(metadata, undefined, 2));
        }
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
