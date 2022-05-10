import { putBucketEncryption as putBucketEncryptionR2, R2 } from '../common/r2/r2.ts';
import { parseOptionalBooleanOption, parseOptionalStringOption } from './cli_common.ts';
import { loadR2Options } from './cli_r2.ts';
import { CLI_VERSION } from './cli_version.ts';

export async function putBucketEncryption(args: (string | number)[], options: Record<string, unknown>) {
    if (options.help || args.length < 1) {
        dumpHelp();
        return;
    }

    const verbose = !!options.verbose;
    if (verbose) {
        R2.DEBUG = true;
    }

    const [ bucket ] = args;
    if (typeof bucket !== 'string') throw new Error(`Bad bucket: ${bucket}`);

    const sseAlgorithm = parseOptionalStringOption('sse-algorithm', options); if (sseAlgorithm === undefined) throw new Error(`--sse-algorithm is required`);
    const bucketKeyEnabled = parseOptionalBooleanOption('bucket-key-enabled', options); if (bucketKeyEnabled === undefined) throw new Error(`--bucket-key-enabled is required`);

    const { origin, region, context } = await loadR2Options(options);

    await putBucketEncryptionR2({ bucket, sseAlgorithm, bucketKeyEnabled, origin, region }, context);
}

function dumpHelp() {
    const lines = [
        `denoflare-r2-put-bucket-encryption ${CLI_VERSION}`,
        'Sets bucket encryption config for a bucket',
        '',
        'USAGE:',
        '    denoflare r2 put-bucket-encryption [FLAGS] [OPTIONS] [bucket] ..[keys]',
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
