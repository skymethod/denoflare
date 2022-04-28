import { computeAwsCallBodyLength, uploadPart as uploadPartR2, R2 } from '../common/r2/r2.ts';
import { CliStats, parseOptionalIntegerOption, parseOptionalStringOption } from './cli_common.ts';
import { loadBodyFromOptions, loadR2Options } from './cli_r2.ts';
import { CLI_VERSION } from './cli_version.ts';

export async function uploadPart(args: (string | number)[], options: Record<string, unknown>) {
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

    const { origin, region, context } = await loadR2Options(options);

    const { body, contentMd5 } = await loadBodyFromOptions(options, context.unsignedPayload);

    const result = await uploadPartR2({ bucket, key, uploadId, partNumber, body, origin, region, contentMd5 }, context);
    const millis = Date.now() - CliStats.launchTime;
    console.log(JSON.stringify(result));
    console.log(`put ${computeAwsCallBodyLength(body)} bytes in ${millis}ms`);
}

function dumpHelp() {
    const lines = [
        `denoflare-r2-upload-part ${CLI_VERSION}`,
        'Upload part of a multipart upload',
        '',
        'USAGE:',
        '    denoflare r2 upload-part [FLAGS] [OPTIONS] [bucket] [key]',
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
