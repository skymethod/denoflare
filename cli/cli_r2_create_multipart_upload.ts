import { createMultipartUpload as createMultipartUploadR2, R2 } from '../common/r2/r2.ts';
import { CliStats, denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForR2, loadR2Options } from './cli_r2.ts';

export const CREATE_MULTIPART_UPLOAD_COMMAND = denoflareCliCommand(['r2', 'create-multipart-upload'], 'Start a multipart upload and return an upload ID')
    .arg('bucket', 'string', 'Name of the R2 bucket')
    .arg('key', 'string', 'Key of the object to upload')
    .option('cacheControl', 'string', 'Specify caching behavior along the request/reply chain')
    .option('contentDisposition', 'string', 'Specify presentational information for the object')
    .option('contentEncoding', 'string', 'Specify what content encodings have been applied to the object')
    .option('contentLanguage', 'string', 'Specify the language the object is in')
    .option('contentType', 'string', 'A standard MIME type describing the format of the contents')
    .option('expires', 'string', 'The date and time at which the object is no longer cacheable')
    .option('custom', 'name-value-pairs', 'Custom metadata for the object')
    .option('ifMatch', 'string', 'Put the object only if its entity tag (ETag) is the same as the one specified')
    .option('ifNoneMatch', 'string', 'Put the object only if its entity tag (ETag) is different from the one specified')
    .option('ifModifiedSince', 'string', 'Put the object only if it has been modified since the specified time')
    .option('ifUnmodifiedSince', 'string', 'Put the object only if it has not been modified since the specified time')
    .include(commandOptionsForR2())
    .docsLink('/cli/r2#create-multipart-upload')
    ;

export async function createMultipartUpload(args: (string | number)[], options: Record<string, unknown>) {
    if (CREATE_MULTIPART_UPLOAD_COMMAND.dumpHelp(args, options)) return;

    const { bucket, key, verbose, cacheControl, contentDisposition, contentEncoding, contentLanguage, contentType, expires, custom: customMetadata, ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince } = CREATE_MULTIPART_UPLOAD_COMMAND.parse(args, options);

    if (verbose) {
        R2.DEBUG = true;
    }

    const { origin, region, context, urlStyle } = await loadR2Options(options);

    const result = await createMultipartUploadR2({ 
        bucket, key, origin, region, urlStyle, cacheControl, contentDisposition, contentEncoding, contentLanguage, expires, contentType, customMetadata, ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince
    }, context);
    console.log(JSON.stringify(result, undefined, 2));

    const millis = Date.now() - CliStats.launchTime;
    console.log(`copied in ${millis}ms`);
}
