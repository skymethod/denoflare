import { uploadPartCopy as uploadPartCopyR2, R2 } from '../common/r2/r2.ts';
import { CliStats, parseOptionalIntegerOption, parseOptionalStringOption } from './cli_common.ts';
import { loadR2Options } from './cli_r2.ts';
import { CLI_VERSION } from './cli_version.ts';

export async function uploadPartCopy(args: (string | number)[], options: Record<string, unknown>) {
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

    const uploadId = parseOptionalStringOption('upload-id', options); if (!uploadId) throw new Error(`Must provide --upload-id`);
    const partNumber = parseOptionalIntegerOption('part-number', options); if (partNumber === undefined) throw new Error(`Must provide --part-number`);

    const sourceBucket = parseOptionalStringOption('source-bucket', options) || bucket;
    const sourceKey = parseOptionalStringOption('source-key', options); if (!sourceKey) throw new Error(`--source-key is required`);
    const sourceRange = parseOptionalStringOption('source-range', options);
    const ifMatch = parseOptionalStringOption('if-match', options);
    const ifModifiedSince = parseOptionalStringOption('if-modified-since', options);
    const ifNoneMatch = parseOptionalStringOption('if-none-match', options);
    const ifUnmodifiedSince = parseOptionalStringOption('if-unmodified-since', options);

    const { origin, region, context } = await loadR2Options(options);

    const result = await uploadPartCopyR2({ 
        bucket, key, uploadId, partNumber, origin, region, 
        sourceBucket, sourceKey, sourceRange, ifMatch, ifModifiedSince, ifNoneMatch, ifUnmodifiedSince,
    }, context);
    console.log(JSON.stringify(result, undefined, 2));

    const millis = Date.now() - CliStats.launchTime;
    console.log(`copied in ${millis}ms`);
}

function dumpHelp() {
    const lines = [
        `denoflare-r2-upload-part-copy ${CLI_VERSION}`,
        'Copy R2 part from a given source bucket and key',
        '',
        'USAGE:',
        '    denoflare r2 upload-part-copy [FLAGS] [OPTIONS] [bucket] [key]',
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
