import { abortMultipartUpload as abortMultipartUploadR2, R2 } from '../common/r2/r2.ts';
import { loadR2Options } from './cli_r2.ts';
import { CLI_VERSION } from './cli_version.ts';

export async function abortMultipartUpload(args: (string | number)[], options: Record<string, unknown>) {
    if (options.help || args.length < 3) {
        dumpHelp();
        return;
    }

    const verbose = !!options.verbose;
    if (verbose) {
        R2.DEBUG = true;
    }

    const [ bucket, key, uploadId ] = args;
    if (typeof bucket !== 'string') throw new Error(`Bad bucket: ${bucket}`);
    if (typeof key !== 'string') throw new Error(`Bad key: ${key}`);
    if (typeof uploadId !== 'string') throw new Error(`Bad uploadId: ${uploadId}`);

    const { origin, region, context } = await loadR2Options(options);

    await abortMultipartUploadR2({ bucket, key, uploadId, origin, region }, context);
}

function dumpHelp() {
    const lines = [
        `denoflare-r2-abort-multipart-upload ${CLI_VERSION}`,
        'Abort an existing multipart upload',
        '',
        'USAGE:',
        '    denoflare r2 abort-multipart-upload [FLAGS] [OPTIONS] [bucket] [key] [uploadId]',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'ARGS:',
        '    <bucket>      Name of the R2 bucket',
        '    <key>         Name of the R2 object key',
        '    <uploadId>    Id of the existing multipart upload',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
