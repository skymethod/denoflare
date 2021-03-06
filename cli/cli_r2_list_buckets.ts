import { listBuckets as listBucketsR2, R2 } from '../common/r2/r2.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { loadR2Options, commandOptionsForR2 } from './cli_r2.ts';

export const LIST_BUCKETS_COMMAND = denoflareCliCommand(['r2', 'list-buckets'], 'List all R2 buckets')
    .include(commandOptionsForR2({ hideUrlStyle: true }))
    .docsLink('/cli/r2#list-buckets')
    ;

export async function listBuckets(args: (string | number)[], options: Record<string, unknown>) {
    if (LIST_BUCKETS_COMMAND.dumpHelp(args, options)) return;

    const { verbose } = LIST_BUCKETS_COMMAND.parse(args, options);

    if (verbose) {
        R2.DEBUG = true;
    }

    const { origin, region, context } = await loadR2Options(options);

    const result = await listBucketsR2({ origin, region }, context);
    console.log(JSON.stringify(result, undefined, 2));
}
