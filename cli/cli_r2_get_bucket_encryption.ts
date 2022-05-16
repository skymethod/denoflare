import { getBucketEncryption as getBucketEncryptionR2, R2 } from '../common/r2/r2.ts';
import { commandOptionsForR2, loadR2Options } from './cli_r2.ts';
import { denoflareCliCommand } from './cli_common.ts';

export const GET_BUCKET_ENCRYPTION_COMMAND = denoflareCliCommand(['r2', 'get-bucket-encryption'], 'Gets encryption config for a bucket')
    .arg('bucket', 'string', 'Name of the R2 bucket')
    .include(commandOptionsForR2)
    ;

export async function getBucketEncryption(args: (string | number)[], options: Record<string, unknown>) {
    if (GET_BUCKET_ENCRYPTION_COMMAND.dumpHelp(args, options)) return;

    const { verbose, bucket } = GET_BUCKET_ENCRYPTION_COMMAND.parse(args, options);
   
    if (verbose) {
        R2.DEBUG = true;
    }

    const { origin, region, context } = await loadR2Options(options);

    const result = await getBucketEncryptionR2({ bucket, origin, region }, context);
    console.log(JSON.stringify(result, undefined, 2));
}
