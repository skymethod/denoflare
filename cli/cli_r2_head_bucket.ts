import { computeHeadersString, headBucket as headBucketR2, R2 } from '../common/r2/r2.ts';
import { commandOptionsForR2, loadR2Options } from './cli_r2.ts';
import { denoflareCliCommand } from './cli_common.ts';

export const HEAD_BUCKET_COMMAND = denoflareCliCommand(['r2', 'head-bucket'], 'Determine if an R2 bucket exists')
    .arg('bucket', 'string', 'Name of the R2 bucket')
    .include(commandOptionsForR2)
    ;

export async function headBucket(args: (string | number)[], options: Record<string, unknown>) {
    if (HEAD_BUCKET_COMMAND.dumpHelp(args, options)) return;

    const { verbose, bucket } = HEAD_BUCKET_COMMAND.parse(args, options);

    if (verbose) {
        R2.DEBUG = true;
    }

    const { origin, region, context } = await loadR2Options(options);

    const response = await headBucketR2({ bucket, origin, region }, context);
    console.log(`${response.status} ${computeHeadersString(response.headers)}`);
}
