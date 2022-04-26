import { computeAwsCallBodyLength, putObject as putObjectR2, R2 } from '../common/r2/r2.ts';
import { CliStats, parseNameValuePairsOption, parseOptionalStringOption } from './cli_common.ts';
import { loadBodyFromOptions, loadR2Options } from './cli_r2.ts';
import { CLI_VERSION } from './cli_version.ts';

export async function putObject(args: (string | number)[], options: Record<string, unknown>) {
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

    const { body, contentMd5 } = await loadBodyFromOptions(options);

    const { origin, region, context } = await loadR2Options(options);

    await putObjectR2({ bucket, key, body, origin, region, cacheControl, contentDisposition, contentEncoding, contentLanguage, contentMd5, expires, contentType, customMetadata }, context);
    const millis = Date.now() - CliStats.launchTime;
    console.log(`put ${computeAwsCallBodyLength(body)} bytes in ${millis}ms`);
}

function dumpHelp() {
    const lines = [
        `denoflare-r2-put-object ${CLI_VERSION}`,
        'Put R2 object for a given key',
        '',
        'USAGE:',
        '    denoflare r2 put-object [FLAGS] [OPTIONS] [bucket] [key]',
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
