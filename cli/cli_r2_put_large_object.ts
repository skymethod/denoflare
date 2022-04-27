import { Bytes } from '../common/bytes.ts';
import { createMultipartUpload, uploadPart, abortMultipartUpload, completeMultipartUpload, R2, CompletedPart } from '../common/r2/r2.ts';
import { CliStats } from './cli_common.ts';
import { loadR2Options } from './cli_r2.ts';
import { CLI_VERSION } from './cli_version.ts';

export async function putLargeObject(args: (string | number)[], options: Record<string, unknown>) {
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

    const { origin, region, context } = await loadR2Options(options);

    const { file } = options;
    if (typeof file !== 'string') throw new Error(`Must provide --file`);

    const start = Date.now();
    const bytes = await Deno.readFile(file);
    console.log(`Read ${bytes.length} bytes in ${Date.now() - start}ms`);

    const { uploadId } = await createMultipartUpload({ bucket, key, origin, region }, context);
    let completed = false;
    try {
        const partSize = 1024 * 1024 * 200;
        const partsNum = Math.ceil(bytes.length / partSize);
        const parts: CompletedPart[] = [];
        for (let i = 0; i < partsNum; i++) {
            const start = i * partSize;
            const end = Math.min((i + 1) * partSize, bytes.length);
            const part = new Bytes(bytes.slice(start, end));
            const partNumber = i + 1;
            console.log(`Uploading part ${partNumber} of ${partsNum}`);
            const start2 = Date.now();
            const { etag } = await uploadPart({ bucket, key, uploadId, partNumber, body: part, origin, region }, context);
            console.log(`Put ${part.length} bytes in ${Date.now() - start2}ms`);
            parts.push({ partNumber, etag });
        }

        console.log(`Completing upload`);
        await completeMultipartUpload({ bucket, key, uploadId, parts, origin, region}, context);
        completed = true;
    } finally {
        if (!completed) {
            console.log(`Aborting upload`);
            await abortMultipartUpload({ bucket, key, uploadId, origin, region }, context);
        }
    }

    const millis = Date.now() - CliStats.launchTime;
    console.log(`put ${bytes.length} total bytes in ${millis}ms`);
}

function dumpHelp() {
    const lines = [
        `denoflare-r2-put-large-object ${CLI_VERSION}`,
        'Upload a large file in multiple chunks',
        '',
        'USAGE:',
        '    denoflare r2 put-large-object [FLAGS] [OPTIONS] [bucket] [key]',
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
