import { abortMultipartUpload as abortMultipartUploadR2, R2 } from '../common/r2/r2.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForR2, loadR2Options } from './cli_r2.ts';

export const ABORT_MULTIPART_UPLOAD_COMMAND = denoflareCliCommand(['r2', 'abort-multipart-upload'], 'Abort an existing multipart upload')
    .arg('bucket', 'string', 'Name of the R2 bucket')
    .arg('key', 'string', 'Key of the object')
    .arg('uploadId', 'string', 'Id of the existing multipart upload to abort')
    .include(commandOptionsForR2)
    ;

export async function abortMultipartUpload(args: (string | number)[], options: Record<string, unknown>) {
    if (ABORT_MULTIPART_UPLOAD_COMMAND.dumpHelp(args, options)) return;

    const { bucket, key, uploadId, verbose } = ABORT_MULTIPART_UPLOAD_COMMAND.parse(args, options);

    if (verbose) {
        R2.DEBUG = true;
    }

    const { origin, region, context } = await loadR2Options(options);

    await abortMultipartUploadR2({ bucket, key, uploadId, origin, region }, context);
}
