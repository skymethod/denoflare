import { getBucketLocation as getBucketLocationR2, R2 } from '../common/r2/r2.ts';
import { commandOptionsForR2, loadR2Options } from './cli_r2.ts';
import { denoflareCliCommand } from './cli_common.ts';

export const GET_BUCKET_LOCATION_COMMAND = denoflareCliCommand(['r2', 'get-bucket-location'], 'Returns the region the bucket resides in')
    .arg('bucket', 'string', 'Name of the R2 bucket')
    .include(commandOptionsForR2)
    ;

export async function getBucketLocation(args: (string | number)[], options: Record<string, unknown>) {
    if (GET_BUCKET_LOCATION_COMMAND.dumpHelp(args, options)) return;

    const { verbose, bucket } = GET_BUCKET_LOCATION_COMMAND.parse(args, options);
   
    if (verbose) {
        R2.DEBUG = true;
    }

    const { origin, region, context } = await loadR2Options(options);

    const result = await getBucketLocationR2({ bucket, origin, region }, context);
    console.log(JSON.stringify(result, undefined, 2));
}
