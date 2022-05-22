import { listObjectsV2, R2 } from '../common/r2/r2.ts';
import { loadR2Options, commandOptionsForR2 } from './cli_r2.ts';
import { denoflareCliCommand } from './cli_common.ts';

export const LIST_OBJECTS_COMMAND = denoflareCliCommand(['r2', 'list-objects'], 'List objects within an R2 bucket (list-objects-v2)')
    .arg('bucket', 'string', 'Name of the R2 bucket')
    .option('maxKeys', 'integer', 'Limit the number of keys to return', { min: 0, max: 1000 })
    .option('continuationToken', 'string', 'Continue the listing on this bucket with a previously returned token (token is obfuscated and is not a real key)')
    .option('startAfter', 'string', 'Start listing after this specified key, can be any key in the bucket', { hint: 'key' })
    .option('prefix', 'string', 'Limit to keys that begin with the specified prefix')
    .option('delimiter', 'string', 'The character used to group keys', { hint: 'char' })
    .option('encodingType', 'enum', 'Encoding used to encode keys in the response', { value: 'url', description: 'Url encoding' }, { value: 'url', description: 'Url encoding'})
    .option('fetchOwner', 'boolean', 'If set, return the owner info for each item')
    .include(commandOptionsForR2())
    .docsLink('/cli/r2#list-objects')
    ;
    
export async function listObjects(args: (string | number)[], options: Record<string, unknown>) {
    if (LIST_OBJECTS_COMMAND.dumpHelp(args, options)) return;

    const { bucket, verbose, maxKeys, continuationToken, startAfter, prefix,  delimiter,  encodingType, fetchOwner } = LIST_OBJECTS_COMMAND.parse(args, options);

    if (verbose) {
        R2.DEBUG = true;
    }

    const { origin, region, context, urlStyle } = await loadR2Options(options);

    const result = await listObjectsV2({ bucket, origin, region, maxKeys, continuationToken, delimiter, prefix, startAfter, encodingType, fetchOwner, urlStyle }, context);
    console.log(JSON.stringify(result, undefined, 2));
}
