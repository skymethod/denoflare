import { listMultipartUploads as listMultipartUploadsR2, R2 } from '../common/r2/r2.ts';
import { loadR2Options, commandOptionsForR2 } from './cli_r2.ts';
import { denoflareCliCommand } from './cli_common.ts';

export const LIST_MULTIPART_UPLOADS_COMMAND = denoflareCliCommand(['r2', 'list-multipart-uploads'], 'List in-progress multipart uploads within an R2 bucket')
    .arg('bucket', 'string', 'Name of the R2 bucket')
    .option('delimiter', 'string', 'The character used to group keys', { hint: 'char' })
    .option('encodingType', 'enum', 'Encoding used to encode keys in the response', { value: 'url', description: 'Url encoding' })
    .option('keyMarker', 'string', 'Together with upload-id-marker, specifies the multipart upload after which listing should begin')
    .option('maxUploads', 'integer', 'Limit the number of multipart uploads to return', { min: 0, max: 1000 })
    .option('prefix', 'string', 'Limit to uploads for keys that begin with the specified prefix')
    .option('uploadIdMarker', 'string', 'Together with key-marker, specifies the upload after which listing should begin')
    .include(commandOptionsForR2())
    .docsLink('/cli/r2#list-multipart-uploads')
    ;
    
export async function listMultipartUploads(args: (string | number)[], options: Record<string, unknown>) {
    if (LIST_MULTIPART_UPLOADS_COMMAND.dumpHelp(args, options)) return;

    const { bucket, verbose, delimiter, encodingType, keyMarker, maxUploads, prefix, uploadIdMarker } = LIST_MULTIPART_UPLOADS_COMMAND.parse(args, options);

    if (verbose) {
        R2.DEBUG = true;
    }

    const { origin, region, context, urlStyle } = await loadR2Options(options);

    const result = await listMultipartUploadsR2({ bucket, origin, region, delimiter, encodingType, keyMarker, maxUploads, prefix, uploadIdMarker, urlStyle }, context);
    console.log(JSON.stringify(result, undefined, 2));
}
