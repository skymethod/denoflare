import { deleteObjects as deleteObjectsR2, R2 } from '../common/r2/r2.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForR2, loadR2Options } from './cli_r2.ts';

export const DELETE_OBJECTS_COMMAND = denoflareCliCommand(['r2', 'delete-objects'], 'Delete R2 objects for the given keys')
    .arg('bucket', 'string', 'Name of the R2 bucket')
    .arg('key', 'strings', 'Keys of the objects to delete')
    .option('quiet', 'boolean', 'Enable quiet mode, response will only include keys where the delete action encountered an error')
    .include(commandOptionsForR2)
    ;

export async function deleteObjects(args: (string | number)[], options: Record<string, unknown>) {
    if (DELETE_OBJECTS_COMMAND.dumpHelp(args, options)) return;
    
    const { bucket, key: items, verbose, quiet } = DELETE_OBJECTS_COMMAND.parse(args, options);

    if (verbose) {
        R2.DEBUG = true;
    }

    const { origin, region, context } = await loadR2Options(options);

    const result = await deleteObjectsR2({ bucket, items, origin, region, quiet }, context);
    console.log(JSON.stringify(result, undefined, 2));
}
