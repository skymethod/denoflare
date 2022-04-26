import { deleteObjects as deleteObjectsR2, R2 } from '../common/r2/r2.ts';
import { parseOptionalBooleanOption } from './cli_common.ts';
import { loadR2Options } from './cli_r2.ts';
import { CLI_VERSION } from './cli_version.ts';

export async function deleteObjects(args: (string | number)[], options: Record<string, unknown>) {
    if (options.help || args.length < 2) {
        dumpHelp();
        return;
    }

    const verbose = !!options.verbose;
    if (verbose) {
        R2.DEBUG = true;
    }

    const [ bucket, ...keys ] = args;
    if (typeof bucket !== 'string') throw new Error(`Bad bucket: ${bucket}`);
    const items = keys.map(v => String(v));

    const quiet = parseOptionalBooleanOption('quiet', options);

    const { origin, region, context } = await loadR2Options(options);

    const result = await deleteObjectsR2({ bucket, items, origin, region, quiet }, context);
    console.log(JSON.stringify(result, undefined, 2));
}

function dumpHelp() {
    const lines = [
        `denoflare-r2-delete-objects ${CLI_VERSION}`,
        'Delete R2 objects for the given keys',
        '',
        'USAGE:',
        '    denoflare r2 delete-object [FLAGS] [OPTIONS] [bucket] ..[keys]',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'ARGS:',
        '    <bucket>      Name of the R2 bucket',
        '    <keys>        Name of the R2 object keys to delete',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
