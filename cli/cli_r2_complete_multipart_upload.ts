import { CompletedPart, completeMultipartUpload as completeMultipartUploadR2, R2 } from '../common/r2/r2.ts';
import { CliStats } from './cli_common.ts';
import { loadR2Options, surroundWithDoubleQuotesIfNecessary } from './cli_r2.ts';
import { CLI_VERSION } from './cli_version.ts';

export async function completeMultipartUpload(args: (string | number)[], options: Record<string, unknown>) {
    if (options.help || args.length < 3) {
        dumpHelp();
        return;
    }

    const verbose = !!options.verbose;
    if (verbose) {
        R2.DEBUG = true;
    }

    const [ bucket, key, uploadId, ...partSpecs ] = args;
    if (typeof bucket !== 'string') throw new Error(`Bad bucket: ${bucket}`);
    if (typeof key !== 'string') throw new Error(`Bad key: ${key}`);
    if (typeof uploadId !== 'string') throw new Error(`Bad uploadId: ${uploadId}`);

    const parts = partSpecs.map(parsePartSpec);

    const { origin, region, context } = await loadR2Options(options);

    const result = await completeMultipartUploadR2({ bucket, key, uploadId, parts, origin, region }, context);
    console.log(JSON.stringify(result, undefined, 2));

    const millis = Date.now() - CliStats.launchTime;
    console.log(`completed in ${millis}ms`);
}

function parsePartSpec(partSpec: unknown): CompletedPart {
    if (typeof partSpec !== 'string') throw new Error(`Invalid part: ${partSpec}`);
    const [ partNumberStr, etagStr ] = partSpec.split(':');
    if (typeof partNumberStr !== 'string' || typeof etagStr !== 'string') throw new Error(`Invalid part: ${partSpec}`);
    const partNumber = parseInt(partNumberStr);
    const etag = surroundWithDoubleQuotesIfNecessary(etagStr)!;
    return { partNumber, etag };
}

function dumpHelp() {
    const lines = [
        `denoflare-r2-complete-multipart-upload ${CLI_VERSION}`,
        'Complete R2 multipart upload',
        '',
        'USAGE:',
        '    denoflare r2 complete-multipart-upload [FLAGS] [OPTIONS] [bucket] [key] [uploadId] ...[parts]',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'ARGS:',
        '    <bucket>      Name of the R2 bucket',
        '    <key>         Name of the R2 object key',
        '    <uploadId>    ID of the multipart upload',
        '    <parts>       partNumber:etag',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
