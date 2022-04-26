import { createMultipartUpload as createMultipartUploadR2, R2 } from '../common/r2/r2.ts';
import { CliStats, parseNameValuePairsOption, parseOptionalStringOption } from './cli_common.ts';
import { loadR2Options } from './cli_r2.ts';
import { CLI_VERSION } from './cli_version.ts';

export async function createMultipartUpload(args: (string | number)[], options: Record<string, unknown>) {
    if (options.help || args.length < 2) {
        dumpHelp();
        return;
    }

    const verbose = !!options.verbose;
    if (verbose) {
        R2.DEBUG = true;
    }

    const [ bucket, key ] = args;
    if (typeof bucket !== 'string') throw new Error(`Bad bucket: ${bucket}`);
    if (typeof key !== 'string') throw new Error(`Bad key: ${key}`);

    const cacheControl = parseOptionalStringOption('cache-control', options);
    const contentDisposition = parseOptionalStringOption('content-disposition', options);
    const contentEncoding = parseOptionalStringOption('content-encoding', options);
    const contentLanguage = parseOptionalStringOption('content-language', options);
    const contentType = parseOptionalStringOption('content-type', options);
    const expires = parseOptionalStringOption('expires', options);
    const customMetadata = parseNameValuePairsOption('custom', options);

    const { origin, region, context } = await loadR2Options(options);

    const result = await createMultipartUploadR2({ 
        bucket, key, origin, region, cacheControl, contentDisposition, contentEncoding, contentLanguage, expires, contentType, customMetadata, 
    }, context);
    console.log(JSON.stringify(result, undefined, 2));

    const millis = Date.now() - CliStats.launchTime;
    console.log(`copied in ${millis}ms`);
}

function dumpHelp() {
    const lines = [
        `denoflare-r2-create-multipart-upload ${CLI_VERSION}`,
        'Copy R2 object from a given source bucket and key',
        '',
        'USAGE:',
        '    denoflare r2 create-multipart-upload [FLAGS] [OPTIONS] [bucket] [key]',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'ARGS:',
        '    <bucket>      Name of the R2 bucket',
        '    <key>         Name of the R2 object key',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
