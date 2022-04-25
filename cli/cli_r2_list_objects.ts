import { listObjectsV2, R2 } from '../common/r2/r2.ts';
import { CLI_VERSION } from './cli_version.ts';
import { parseOptionalStringOption } from './cli_common.ts';
import { loadR2Options } from './cli_r2.ts';

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
    const encodingType = parseOptionalStringOption('encoding-type', options);

    const { origin, region, context } = await loadR2Options(options);

    const result = await listObjectsV2({ bucket, origin, region, maxKeys, continuationToken, delimiter, prefix, startAfter, encodingType }, context);
    console.log(JSON.stringify(result, undefined, 2));
}

//

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
