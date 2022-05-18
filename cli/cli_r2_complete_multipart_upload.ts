import { CompletedPart, completeMultipartUpload as completeMultipartUploadR2, R2 } from '../common/r2/r2.ts';
import { CliStats, denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForR2, loadR2Options, surroundWithDoubleQuotesIfNecessary } from './cli_r2.ts';

export const COMPLETE_MULTIPART_UPLOAD_COMMAND = denoflareCliCommand(['r2', 'complete-multipart-upload'], 'Complete an existing multipart upload')
    .arg('bucket', 'string', 'Name of the R2 bucket')
    .arg('key', 'string', 'Key of the object')
    .arg('uploadId', 'string', 'Id of the existing multipart upload to complete')
    .arg('part', 'strings', 'partNumber:etag')
    .include(commandOptionsForR2())
    ;

export async function completeMultipartUpload(args: (string | number)[], options: Record<string, unknown>) {
    if (COMPLETE_MULTIPART_UPLOAD_COMMAND.dumpHelp(args, options)) return;

    const { bucket, key, uploadId, part: partSpecs, verbose } = COMPLETE_MULTIPART_UPLOAD_COMMAND.parse(args, options);

    if (verbose) {
        R2.DEBUG = true;
    }

    const parts = partSpecs.map(parsePartSpec);

    const { origin, region, context, urlStyle } = await loadR2Options(options);

    const result = await completeMultipartUploadR2({ bucket, key, uploadId, parts, origin, region, urlStyle }, context);
    console.log(JSON.stringify(result, undefined, 2));

    const millis = Date.now() - CliStats.launchTime;
    console.log(`completed in ${millis}ms`);
}

//

function parsePartSpec(partSpec: unknown): CompletedPart {
    if (typeof partSpec !== 'string') throw new Error(`Invalid part: ${partSpec}`);
    const [ partNumberStr, etagStr ] = partSpec.split(':');
    if (typeof partNumberStr !== 'string' || typeof etagStr !== 'string') throw new Error(`Invalid part: ${partSpec}`);
    const partNumber = parseInt(partNumberStr);
    const etag = surroundWithDoubleQuotesIfNecessary(etagStr)!;
    return { partNumber, etag };
}
