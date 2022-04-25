import { deleteObject as deleteObjectR2, R2 } from '../common/r2/r2.ts';
import { parseOptionalStringOption } from './cli_common.ts';
import { loadR2Options } from './cli_r2.ts';
import { CLI_VERSION } from './cli_version.ts';

export async function deleteObject(args: (string | number)[], options: Record<string, unknown>) {
    if (options.help || args.length < 2) {
        dumpHelp();
        return;
    }

    const verbose = !!options.verbose;
    if (verbose) {
        R2.DEBUG = true;
    }

    const [ bucket, key ] = args;
    if (typeof bucket !== 'string') throw new Error(`Bad bucket: ${bucket}`);
    if (typeof key !== 'string') throw new Error(`Bad key: ${key}`);

    const versionId = parseOptionalStringOption('version-id', options);
    
    const { origin, region, context } = await loadR2Options(options);

    await deleteObjectR2({ bucket, key, origin, region, versionId }, context);
}

function dumpHelp() {
    const lines = [
        `denoflare-r2-delete-object ${CLI_VERSION}`,
        'Delete R2 object for a given key',
        '',
        'USAGE:',
        '    denoflare r2 delete-object [FLAGS] [OPTIONS] [bucket] [key]',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'ARGS:',
        '    <bucket>      Name of the R2 bucket',
        '    <key>         Name of the R2 object key',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
