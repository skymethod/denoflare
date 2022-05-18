import { copyObject as copyObjectR2, R2 } from '../common/r2/r2.ts';
import { CliStats, denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForR2, loadR2Options } from './cli_r2.ts';

export const COPY_OBJECT_COMMAND = denoflareCliCommand(['r2', 'copy-object'], 'Copy R2 object from a given source bucket and key')
    .arg('bucket', 'string', 'Name of the destination R2 bucket')
    .arg('key', 'string', 'Key of the destination object')
    .option('sourceBucket', 'string', 'R2 Bucket of the source object (default: destination bucket)')
    .option('sourceKey', 'required-string', 'Key of the source object')
    .optionGroup()
    .option('cacheControl', 'string', 'Specify caching behavior along the request/reply chain')
    .option('contentDisposition', 'string', 'Specify presentational information for the object')
    .option('contentEncoding', 'string', 'Specify what content encodings have been applied to the object')
    .option('contentLanguage', 'string', 'Specify the language the object is in')
    .option('contentType', 'string', 'A standard MIME type describing the format of the contents')
    .option('expires', 'string', 'The date and time at which the object is no longer cacheable')
    .option('custom', 'name-value-pairs', 'Custom metadata for the object')
    .optionGroup()
    .option('ifMatch', 'string', 'Copies the object if its entity tag (ETag) matches the specified tag')
    .option('ifNoneMatch', 'string', 'Copies the object if its entity tag (ETag) is different than the specified ETag')
    .option('ifModifiedSince', 'string', 'Copies the object if it has been modified since the specified time')
    .option('ifUnmodifiedSince', 'string', `Copies the object if it hasn't been modified since the specified time`)
    .include(commandOptionsForR2())
    ;

export async function copyObject(args: (string | number)[], options: Record<string, unknown>) {
    if (COPY_OBJECT_COMMAND.dumpHelp(args, options)) return;

    const { bucket, key, verbose, sourceKey, sourceBucket, cacheControl, contentDisposition, contentEncoding, contentLanguage, contentType, expires, custom: customMetadata, ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince } = COPY_OBJECT_COMMAND.parse(args, options);

    if (verbose) {
        R2.DEBUG = true;
    }

    const { origin, region, context, urlStyle } = await loadR2Options(options);

    const result = await copyObjectR2({ 
        bucket, key, origin, region, urlStyle, cacheControl, contentDisposition, contentEncoding, contentLanguage, expires, contentType, customMetadata, 
        sourceBucket: sourceBucket ?? bucket, sourceKey, ifMatch, ifModifiedSince, ifNoneMatch, ifUnmodifiedSince,
    }, context);
    console.log(JSON.stringify(result, undefined, 2));

    const millis = Date.now() - CliStats.launchTime;
    console.log(`copied in ${millis}ms`);
}
