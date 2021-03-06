import { uploadPartCopy as uploadPartCopyR2, R2 } from '../common/r2/r2.ts';
import { CliStats, denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForR2, loadR2Options } from './cli_r2.ts';

export const UPLOAD_PART_COPY_COMMAND = denoflareCliCommand(['r2', 'upload-part-copy'], 'Copy R2 part from a given source bucket and key')
    .arg('bucket', 'string', 'Name of the R2 bucket')
    .arg('key', 'string', 'Key of the object')
    .option('uploadId', 'required-string', 'Id of the existing multipart upload to complete')
    .option('partNumber', 'required-integer', 'Number of the part', { min: 1, max: 10000 })
    .option('sourceBucket', 'string', 'R2 Bucket of the source object (default: destination bucket)')
    .option('sourceKey', 'required-string', 'Key of the source object')
    .option('sourceRange', 'string', 'The range of bytes to copy from the source object')
    .optionGroup()
    .option('ifMatch', 'string', 'Copies the object part if its entity tag (ETag) matches the specified tag')
    .option('ifNoneMatch', 'string', 'Copies the object part if its entity tag (ETag) is different than the specified ETag')
    .option('ifModifiedSince', 'string', 'Copies the object part if it has been modified since the specified time')
    .option('ifUnmodifiedSince', 'string', `Copies the object part if it hasn't been modified since the specified time`)
    .include(commandOptionsForR2())
    .docsLink('/cli/r2#upload-part-copy')
    ;

export async function uploadPartCopy(args: (string | number)[], options: Record<string, unknown>) {
    if (UPLOAD_PART_COPY_COMMAND.dumpHelp(args, options)) return;

    const { bucket, key, uploadId, partNumber, verbose, sourceKey, sourceBucket, sourceRange, ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince } = UPLOAD_PART_COPY_COMMAND.parse(args, options);

    if (verbose) {
        R2.DEBUG = true;
    }
    
    const { origin, region, context, urlStyle } = await loadR2Options(options);

    const result = await uploadPartCopyR2({ 
        bucket, key, uploadId, partNumber, origin, region, urlStyle,
        sourceBucket: sourceBucket ?? bucket, sourceKey, sourceRange, ifMatch, ifModifiedSince, ifNoneMatch, ifUnmodifiedSince,
    }, context);
    console.log(JSON.stringify(result, undefined, 2));

    const millis = Date.now() - CliStats.launchTime;
    console.log(`copied in ${millis}ms`);
}
