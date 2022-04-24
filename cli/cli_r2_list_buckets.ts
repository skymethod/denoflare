import { listBuckets as listBucketsR2, R2 } from '../common/r2/r2.ts';
import { CLI_VERSION } from './cli_version.ts';
import { loadR2Options } from './cli_r2.ts';

export async function listBuckets(args: (string | number)[], options: Record<string, unknown>) {
    if (options.help) {
        dumpHelp();
        return;
    }

    const verbose = !!options.verbose;
    if (verbose) {
        R2.DEBUG = true;
    }

    const { origin, region, context } = await loadR2Options(options);

    const result = await listBucketsR2({ origin, region }, context);
    console.log(JSON.stringify(result, undefined, 2));
}

//

function dumpHelp() {
    const lines = [
        `denoflare-r2-list-buckets ${CLI_VERSION}`,
        'List all R2 buckets',
        '',
        'USAGE:',
        '    denoflare r2 list-buckets [FLAGS] [OPTIONS]',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'ARGS:',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
