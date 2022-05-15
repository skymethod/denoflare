import { listBuckets as listBucketsR2, R2 } from '../common/r2/r2.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { loadR2Options, commandOptionsForR2 } from './cli_r2.ts';

const cmd = denoflareCliCommand(['r2', 'list-buckets'], 'List all R2 buckets')
    .include(commandOptionsForR2)
    ;

export async function listBuckets(args: (string | number)[], options: Record<string, unknown>) {
    if (cmd.dumpHelp(args, options)) return;

    const { verbose } = cmd.parse(args, options);

    if (verbose) {
        R2.DEBUG = true;
    }

    const { origin, region, context } = await loadR2Options(options);

    const result = await listBucketsR2({ origin, region }, context);
    console.log(JSON.stringify(result, undefined, 2));
}
