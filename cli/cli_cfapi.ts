import { loadConfig, resolveProfile } from './config_loader.ts';
import { CLI_VERSION } from './cli_version.ts';
import { CloudflareApi, createR2Bucket, deleteR2Bucket, deleteWorkersDomain, getKeyMetadata, getKeyValue, getWorkerAccountSettings, listFlags, listR2Buckets, listWorkersDomains, listZones, putKeyValue, putWorkerAccountSettings, putWorkersDomain } from '../common/cloudflare_api.ts';
import { check } from '../common/check.ts';
import { Bytes } from '../common/bytes.ts';
import { parseOptionalIntegerOption, parseOptionalStringOption, parseRequiredStringOption } from './cli_common.ts';

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
    } else if (apiCommand === 'list-buckets') {
        const value = await listR2Buckets(accountId, apiToken);
        console.log(value);
    } else if (apiCommand === 'create-bucket') {
        const [ _, bucketName ] = args;
        check('bucketName', bucketName, typeof bucketName === 'string' && bucketName.length > 0);
        await createR2Bucket(accountId, bucketName, apiToken);
    } else if (apiCommand === 'delete-bucket') {
        const [ _, bucketName ] = args;
        check('bucketName', bucketName, typeof bucketName === 'string' && bucketName.length > 0);
        await deleteR2Bucket(accountId, bucketName, apiToken);
    } else if (apiCommand === 'list-flags') {
        const value = await listFlags(accountId, apiToken);
        console.log(value);
    } else if (apiCommand === 'list-workers-domains') {
        const hostname = parseOptionalStringOption('hostname', options);
        const value = await listWorkersDomains(accountId, apiToken, { hostname });
        console.log(value);
    } else if (apiCommand === 'list-zones') {
        const match = parseOptionalStringOption('match', options); if (typeof match === 'string' && match !== 'any' && match !== 'all') throw new Error(`Bad match: ${match}`);
        const name = parseOptionalStringOption('name', options);
        const order = parseOptionalStringOption('order', options); if (typeof order === 'string' && order !== 'name' && order !== 'status' && order !== 'account.id' && order !== 'account.name') throw new Error(`Bad order: ${order}`);
        const page = parseOptionalIntegerOption('page', options);
        const perPage = parseOptionalIntegerOption('per-page', options);
        const status = parseOptionalStringOption('status', options); if (typeof status === 'string' && status !== 'active' && status !== 'pending' && status !== 'initializing' && status !== 'moved' && status !== 'deleted' && status !== 'deactivated' && status !== 'read only') throw new Error(`Bad status: ${status}`);
        const direction = parseOptionalStringOption('direction', options); if (typeof direction === 'string' && direction !== 'asc' && direction !== 'desc') throw new Error(`Bad direction: ${direction}`);
        const value = await listZones(accountId, apiToken, { match, name, order, page, perPage, status, direction });
        console.log(value);
    } else if (apiCommand === 'put-workers-domain') {
        const hostname = parseRequiredStringOption('hostname', options);
        const zoneId = parseRequiredStringOption('zone-id', options);
        const service = parseRequiredStringOption('service', options);
        const environment = parseOptionalStringOption('environment', options) || 'production';
        const value = await putWorkersDomain(accountId, apiToken, { hostname, zoneId, service, environment });
        console.log(value);
    } else if (apiCommand === 'delete-workers-domain') {
        const [ _, workersDomainId ] = args;
        check('workersDomainId', workersDomainId, typeof workersDomainId === 'string');
        await deleteWorkersDomain(accountId, apiToken, { workersDomainId });
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
