import { createBucket as createBucketR2, R2 } from '../common/r2/r2.ts';
import { commandOptionsForR2, loadR2Options } from './cli_r2.ts';
import { denoflareCliCommand } from './cli_common.ts';

export const CREATE_BUCKET_COMMAND = denoflareCliCommand(['r2', 'create-bucket'], 'Create a new R2 bucket')
    .arg('bucket', 'string', 'Name of the R2 bucket')
    .include(commandOptionsForR2)
    ;

export async function createBucket(args: (string | number)[], options: Record<string, unknown>) {
    if (CREATE_BUCKET_COMMAND.dumpHelp(args, options)) return;

    const { verbose, bucket } = CREATE_BUCKET_COMMAND.parse(args, options);

    if (verbose) {
        R2.DEBUG = true;
    }

    const { origin, region, context } = await loadR2Options(options);

    const { location } = await createBucketR2({ bucket, origin, region }, context);
    console.log(location);
}
