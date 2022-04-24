import { Bytes } from '../common/bytes.ts';
import { AwsCredentials, listObjectsV2, R2 } from '../common/r2/r2.ts';
import { CLI_VERSION } from './cli_version.ts';
import { loadConfig, resolveProfile } from './config_loader.ts';

export async function listObjects(args: (string | number)[], options: Record<string, unknown>) {
    if (options.help || args.length < 1) {
        dumpHelp();
        return;
    }

    const verbose = !!options.verbose;
    if (verbose) {
        R2.DEBUG = true;
    }

    const bucket = args[0];
    if (typeof bucket !== 'string') throw new Error(`Bad bucket: ${bucket}`);

    const { 'max-keys': maxKeys, 'continuation-token': continuationToken } = options;
    if (maxKeys !== undefined && typeof maxKeys !== 'number') throw new Error(`Bad max-keys: ${maxKeys}`);
    if (continuationToken !== undefined && typeof continuationToken !== 'string') throw new Error(`Bad continuation-token: ${continuationToken}`);
    const startAfter = parseOptionalStringOption('start-after', options);
    const prefix = parseOptionalStringOption('prefix', options);
    const delimiter = parseOptionalStringOption('delimiter', options);

    const config = await loadConfig(options);
    const { accountId, apiToken, apiTokenId } = await resolveProfile(config, options);
    if (!apiTokenId) throw new Error(`Profile needs an apiTokenId to use the S3 API for R2`);

    const origin = `https://${accountId}.r2.cloudflarestorage.com`;
    const credentials: AwsCredentials = {
        accessKey: apiTokenId,
        secretKey: (await Bytes.ofUtf8(apiToken).sha256()).hex(),
    };

    const result = await listObjectsV2({ bucket, origin, region: 'world', maxKeys, continuationToken, delimiter, prefix, startAfter }, { credentials, userAgent: `denoflare-cli/${CLI_VERSION}` });
    console.log(JSON.stringify(result, undefined, 2));
}

//

function parseOptionalStringOption(name: string, options: Record<string, unknown>): string | undefined {
    const value = options[name];
    if (value === undefined || typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    throw new Error(`Bad ${name}: ${value}`);
}

function dumpHelp() {
    const lines = [
        `denoflare-r2-list-objects ${CLI_VERSION}`,
        'List objects within a bucket',
        '',
        'USAGE:',
        '    denoflare r2 list-objects [FLAGS] [OPTIONS] [bucket]',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'ARGS:',
        '    <bucket>      Name of the R2 bucket',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
