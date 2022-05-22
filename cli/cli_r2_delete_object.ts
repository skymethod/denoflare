import { deleteObject as deleteObjectR2, R2 } from '../common/r2/r2.ts';
import { denoflareCliCommand, parseOptionalStringOption } from './cli_common.ts';
import { commandOptionsForR2, loadR2Options } from './cli_r2.ts';

export const DELETE_OBJECT_COMMAND = denoflareCliCommand(['r2', 'delete-object'], 'Delete R2 object for a given key')
    .arg('bucket', 'string', 'Name of the R2 bucket')
    .arg('key', 'string', 'Key of the object to delete')
    .option('versionId', 'string', 'Returns the version ID of the delete marker created as a result of the DELETE operation')
    .include(commandOptionsForR2())
    .docsLink('/cli/r2#delete-object')
    ;

export async function deleteObject(args: (string | number)[], options: Record<string, unknown>) {
    if (DELETE_OBJECT_COMMAND.dumpHelp(args, options)) return;

    const { bucket, key, verbose } = DELETE_OBJECT_COMMAND.parse(args, options);

    if (verbose) {
        R2.DEBUG = true;
    }

    const versionId = parseOptionalStringOption('version-id', options);
    
    const { origin, region, context, urlStyle } = await loadR2Options(options);

    await deleteObjectR2({ bucket, key, origin, region, versionId, urlStyle }, context);
}
