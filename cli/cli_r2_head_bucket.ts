import { computeHeadersString, headBucket as headBucketR2, R2 } from '../common/r2/r2.ts';
import { CLI_VERSION } from './cli_version.ts';
import { loadR2Options } from './cli_r2.ts';

export async function headBucket(args: (string | number)[], options: Record<string, unknown>) {
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
    
    const { origin, region, context } = await loadR2Options(options);

    const response = await headBucketR2({ bucket, origin, region }, context);
    console.log(`${response.status} ${computeHeadersString(response.headers)}`);
}

//

function dumpHelp() {
    const lines = [
        `denoflare-r2-head-bucket ${CLI_VERSION}`,
        'Determine if an R2 bucket exists',
        '',
        'USAGE:',
        '    denoflare r2 head-bucket [FLAGS] [OPTIONS]',
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
