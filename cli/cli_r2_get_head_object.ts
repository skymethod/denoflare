import { computeHeadersString, getObject as getObjectR2, headObject as headObjectR2, R2 } from '../common/r2/r2.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForR2, loadR2Options, surroundWithDoubleQuotesIfNecessary } from './cli_r2.ts';

export const HEAD_OBJECT_COMMAND = getOrHeadCommand('head-object', 'Get R2 object (metadata only) for a given key');

export async function headObject(args: (string | number)[], options: Record<string, unknown>) {
    if (HEAD_OBJECT_COMMAND.dumpHelp(args, options)) return;

    const { bucket, key, verbose, ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince, range, partNumber } = HEAD_OBJECT_COMMAND.parse(args, options);
    return await getOrHeadObject('HEAD', options, { bucket, key, verbose, ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince, range, partNumber });
}

export const GET_OBJECT_COMMAND = getOrHeadCommand('get-object', 'Get R2 object for a given key');

export async function getObject(args: (string | number)[], options: Record<string, unknown>) {
    if (GET_OBJECT_COMMAND.dumpHelp(args, options)) return;

    const { bucket, key, verbose, ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince, range, partNumber } = GET_OBJECT_COMMAND.parse(args, options);
    return await getOrHeadObject('GET', options, { bucket, key, verbose, ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince, range, partNumber });
}

//

function getOrHeadCommand(name: string, description: string) {
    return denoflareCliCommand(['r2', name], description)
        .arg('bucket', 'string', 'Name of the R2 bucket')
        .arg('key', 'string', 'Key of the object to get')
        .option('ifMatch', 'string', 'Return the object only if its entity tag (ETag) is the same as the one specified')
        .option('ifNoneMatch', 'string', 'Return the object only if its entity tag (ETag) is different from the one specified')
        .option('ifModifiedSince', 'string', 'Return the object only if it has been modified since the specified time')
        .option('ifUnmodifiedSince', 'string', 'Return the object only if it has not been modified since the specified time')
        .option('range', 'string', 'Downloads the specified range bytes of an object, e.g. bytes=0-100')
        .option('partNumber', 'integer', 'Part number of the object being read, effectively performs a ranged GET request for the part specified', { min: 1, max: 10000 })
        .include(commandOptionsForR2)
        ;
}

async function getOrHeadObject(method: 'GET' | 'HEAD', options: Record<string, unknown>, opts: { bucket: string, key: string, verbose: boolean, ifMatch?: string, ifNoneMatch?: string, ifModifiedSince?: string, ifUnmodifiedSince?: string, range?: string, partNumber?: number }) {
    const { verbose, bucket, key, ifMatch: ifMatchOpt, ifNoneMatch: ifNoneMatchOpt, ifModifiedSince, ifUnmodifiedSince, range, partNumber } = opts;

    if (verbose) {
        R2.DEBUG = true;
    }

    const ifMatch = surroundWithDoubleQuotesIfNecessary(ifMatchOpt);
    const ifNoneMatch = surroundWithDoubleQuotesIfNecessary(ifNoneMatchOpt);

    const { origin, region, context } = await loadR2Options(options);
    const response = await (method === 'GET' ? getObjectR2 : headObjectR2)({ bucket, key, origin, region, ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince, partNumber, range }, context);
    if (!response) {
        console.log('(not found)');
        return;
    }
    console.log(`${response.status} ${computeHeadersString(response.headers)}`);
    const contentType = response.headers.get('content-type') || '';
    if (contentType.toLowerCase().includes('text')) {
        console.log(await response.text());
    } else {
        const body = await response.arrayBuffer();
        console.log(`(${body.byteLength} bytes)`);
    }
}
