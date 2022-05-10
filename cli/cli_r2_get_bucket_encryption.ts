import { getBucketEncryption as getBucketEncryptionR2, R2 } from '../common/r2/r2.ts';
import { CLI_VERSION } from './cli_version.ts';
import { loadR2Options } from './cli_r2.ts';

export async function getBucketEncryption(args: (string | number)[], options: Record<string, unknown>) {
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

    const { origin, region, context } = await loadR2Options(options);

    const result = await getBucketEncryptionR2({ bucket, origin, region }, context);
    console.log(JSON.stringify(result, undefined, 2));
}

//

function dumpHelp() {
    const lines = [
        `denoflare-r2-get-bucket-encryption ${CLI_VERSION}`,
        'Gets encryption config for a bucket',
        '',
        'USAGE:',
        '    denoflare r2 get-bucket-encryption [FLAGS] [OPTIONS] [bucket]',
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
