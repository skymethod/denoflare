import { computeAwsCallBodyLength, putObject as putObjectR2, R2 } from '../common/r2/r2.ts';
import { CliStats, denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForLoadBodyFromOptions, commandOptionsForR2, commandOptionsForSsec, loadBodyFromOptions, loadR2Options, loadSsecOptions } from './cli_r2.ts';
import { computeMd5 } from './wasm_crypto.ts';

export const PUT_OBJECT_COMMAND = denoflareCliCommand(['r2', 'put-object'], 'Put R2 object for a given key')
    .arg('bucket', 'string', 'Name of the R2 bucket')
    .arg('key', 'string', 'Key of the object to put')
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
    .include(commandOptionsForLoadBodyFromOptions)
    .include(commandOptionsForSsec)
    .include(commandOptionsForR2())
    .docsLink('/cli/r2#put-object')
    ;

export async function putObject(args: (string | number)[], options: Record<string, unknown>) {
    if (PUT_OBJECT_COMMAND.dumpHelp(args, options)) return;

    const { bucket, key, verbose, cacheControl, contentDisposition, contentEncoding, contentLanguage, contentType, expires, custom: customMetadata, ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince } = PUT_OBJECT_COMMAND.parse(args, options);

    if (verbose) {
        R2.DEBUG = true;
    }

    const { origin, region, context, urlStyle } = await loadR2Options(options);

    const { ssecAlgorithm, ssecKey, ssecKeyMd5 } = await loadSsecOptions(options, computeMd5);

    const { body, contentMd5 } = await loadBodyFromOptions(options, context.unsignedPayload);

    await putObjectR2({ bucket, key, body, origin, region, urlStyle, cacheControl, contentDisposition, contentEncoding, contentLanguage, contentMd5, expires, contentType, customMetadata, ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince, ssecAlgorithm, ssecKey, ssecKeyMd5 }, context);
    const millis = Date.now() - CliStats.launchTime;
    console.log(`put ${computeAwsCallBodyLength(body)} bytes in ${millis}ms`);
}
