import { putBucketEncryption as putBucketEncryptionR2, R2 } from '../common/r2/r2.ts';
import { denoflareCliCommand, parseOptionalBooleanOption, parseOptionalStringOption } from './cli_common.ts';
import { commandOptionsForR2, loadR2Options } from './cli_r2.ts';

export const PUT_BUCKET_ENCRYPTION_COMMAND = denoflareCliCommand(['r2', 'put-bucket-encryption'], 'Sets encryption config for a bucket')
    .arg('bucket', 'string', 'Name of the R2 bucket')
    .include(commandOptionsForR2())
    ;

export async function putBucketEncryption(args: (string | number)[], options: Record<string, unknown>) {
    if (PUT_BUCKET_ENCRYPTION_COMMAND.dumpHelp(args, options)) return;

    const { verbose, bucket } = PUT_BUCKET_ENCRYPTION_COMMAND.parse(args, options);

    if (verbose) {
        R2.DEBUG = true;
    }

    const sseAlgorithm = parseOptionalStringOption('sse-algorithm', options); if (sseAlgorithm === undefined) throw new Error(`--sse-algorithm is required`);
    const bucketKeyEnabled = parseOptionalBooleanOption('bucket-key-enabled', options); if (bucketKeyEnabled === undefined) throw new Error(`--bucket-key-enabled is required`);

    const { origin, region, context, urlStyle } = await loadR2Options(options);

    await putBucketEncryptionR2({ bucket, sseAlgorithm, bucketKeyEnabled, origin, region, urlStyle }, context);
}
