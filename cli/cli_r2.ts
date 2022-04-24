import { CLI_VERSION } from './cli_version.ts';
import { listObjects } from './cli_r2_list_objects.ts';
import { getObject, headObject } from './cli_r2_get_head_object.ts';
import { loadConfig, resolveProfile } from './config_loader.ts';
import { AwsCallContext, AwsCredentials } from '../common/r2/r2.ts';
import { Bytes } from '../common/bytes.ts';

export async function r2(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    const subcommand = args[0];
    if (options.help && args.length === 0 || typeof subcommand !== 'string') {
        dumpHelp();
        return;
    }

    const fn = { 'list-objects': listObjects, 'get-object': getObject, 'head-object': headObject }[subcommand];
    if (fn) {
        await fn(args.slice(1), options);
    } else {
        dumpHelp();
    }
}

export async function loadR2Options(options: Record<string, unknown>): Promise<{ origin: string, region: string, context: AwsCallContext }> {
    const config = await loadConfig(options);
    const { accountId, apiToken, apiTokenId } = await resolveProfile(config, options);
    if (!apiTokenId) throw new Error(`Profile needs an apiTokenId to use the S3 API for R2`);

    const credentials: AwsCredentials = {
        accessKey: apiTokenId,
        secretKey: (await Bytes.ofUtf8(apiToken).sha256()).hex(),
    };
    const origin = `https://${accountId}.r2.cloudflarestorage.com`;
    const region = 'world'
    const context = { credentials, userAgent: `denoflare-cli/${CLI_VERSION}` };
    return { origin, region, context };
}

//

function dumpHelp() {
    const lines = [
        `denoflare-r2 ${CLI_VERSION}`,
        'Manage R2 storage using the S3 compatibility API',
        '',
        'USAGE:',
        '    denoflare r2 [subcommand] [FLAGS] [OPTIONS] [args]',
        '',
        'SUBCOMMANDS:',
        '    list-objects    List objects within a bucket',
        '    get-object      Get R2 object for a given key',
        '',
        'For subcommand-specific help: denoflare site [subcommand] --help',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
