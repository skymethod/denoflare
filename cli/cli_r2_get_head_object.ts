import { computeHeadersString, getObject as getObjectR2, headObject as headObjectR2, R2 } from '../common/r2/r2.ts';
import { parseOptionalStringOption } from './cli_common.ts';
import { loadR2Options, surroundWithDoubleQuotesIfNecessary } from './cli_r2.ts';
import { CLI_VERSION } from './cli_version.ts';

export async function headObject(args: (string | number)[], options: Record<string, unknown>) {
    return await getOrHeadObject('HEAD', args, options);
}

export async function getObject(args: (string | number)[], options: Record<string, unknown>) {
    return await getOrHeadObject('GET', args, options);
}

//

async function getOrHeadObject(method: 'GET' | 'HEAD', args: (string | number)[], options: Record<string, unknown>) {
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

    const ifMatch = surroundWithDoubleQuotesIfNecessary(parseOptionalStringOption('if-match', options));
    const ifNoneMatch = surroundWithDoubleQuotesIfNecessary(parseOptionalStringOption('if-none-match', options));
    const ifModifiedSince = parseOptionalStringOption('if-modified-since', options);
    const ifUnmodifiedSince = parseOptionalStringOption('if-unmodified-since', options);
    const range = parseOptionalStringOption('range', options);

    const { 'part-number': partNumber } = options;
    if (partNumber !== undefined && typeof partNumber !== 'number') throw new Error(`Bad part-number: ${partNumber}`);
    
    const { origin, region, context } = await loadR2Options(options);
    const fn = method === 'GET' ? getObjectR2 : headObjectR2;
    const response = await fn({ bucket, key, origin, region, ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince, partNumber, range }, context);
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

function dumpHelp() {
    const lines = [
        `denoflare-r2-get-object ${CLI_VERSION}`,
        'Get R2 object for a given key',
        '',
        'USAGE:',
        '    denoflare r2 get-object [FLAGS] [OPTIONS] [bucket]',
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
