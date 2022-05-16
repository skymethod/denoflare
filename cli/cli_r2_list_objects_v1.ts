import { listObjects, R2 } from '../common/r2/r2.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForR2, loadR2Options } from './cli_r2.ts';

export const LIST_OBJECTS_V1_COMMAND = denoflareCliCommand(['r2', 'list-objects-v1'], 'List objects within a bucket (deprecated v1 version)')
    .arg('bucket', 'string', 'Name of the R2 bucket')
    .option('maxKeys', 'integer', 'Limit the number of keys to return', { min: 0, max: 1000 })
    .option('marker', 'string', 'Start listing after this specified key, can be any key in the bucket')
    .option('prefix', 'string', 'Limit to keys that begin with the specified prefix')
    .option('delimiter', 'string', 'The character used to group keys', { hint: 'char' })
    .option('encodingType', 'enum', 'Encoding used to encode keys in the response', { value: 'url', description: 'Url encoding' }, { value: 'url', description: 'Url encoding'})
    .include(commandOptionsForR2)
    ;

export async function listObjectsV1(args: (string | number)[], options: Record<string, unknown>) {
    if (LIST_OBJECTS_V1_COMMAND.dumpHelp(args, options)) return;

    const { bucket, verbose, maxKeys, marker, prefix, delimiter, encodingType } = LIST_OBJECTS_V1_COMMAND.parse(args, options);

    if (verbose) {
        R2.DEBUG = true;
    }

    const { origin, region, context } = await loadR2Options(options);

    const result = await listObjects({ bucket, origin, region, maxKeys, marker, delimiter, prefix, encodingType }, context);
    console.log(JSON.stringify(result, undefined, 2));
}
