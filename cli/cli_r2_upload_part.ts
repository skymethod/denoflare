import { computeAwsCallBodyLength, uploadPart as uploadPartR2, R2 } from '../common/r2/r2.ts';
import { CliStats, denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForLoadBodyFromOptions, commandOptionsForR2, loadBodyFromOptions, loadR2Options } from './cli_r2.ts';

export const UPLOAD_PART_COMMAND = denoflareCliCommand(['r2', 'upload-part'], 'Upload part of a multipart upload')
    .arg('bucket', 'string', 'Name of the R2 bucket')
    .arg('key', 'string', 'Key of the object')
    .option('uploadId', 'required-string', 'Id of the existing multipart upload to complete')
    .option('partNumber', 'required-integer', 'Number of the part', { min: 1, max: 10000 })
    .include(commandOptionsForLoadBodyFromOptions)
    .include(commandOptionsForR2())
    .docsLink('/cli/r2#upload-part')
    ;

export async function uploadPart(args: (string | number)[], options: Record<string, unknown>) {
    if (UPLOAD_PART_COMMAND.dumpHelp(args, options)) return;

    const { bucket, key, uploadId, partNumber, verbose } = UPLOAD_PART_COMMAND.parse(args, options);

    if (verbose) {
        R2.DEBUG = true;
    }

    const { origin, region, context, urlStyle } = await loadR2Options(options);

    const { body, contentMd5 } = await loadBodyFromOptions(options, context.unsignedPayload);

    const result = await uploadPartR2({ bucket, key, uploadId, partNumber, body, origin, region, contentMd5, urlStyle }, context);
    const millis = Date.now() - CliStats.launchTime;
    console.log(JSON.stringify(result));
    console.log(`put ${computeAwsCallBodyLength(body)} bytes in ${millis}ms`);
}
