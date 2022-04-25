import { Bytes } from '../common/bytes.ts';
import { computeHeadersString, putObject as putObjectR2, R2 } from '../common/r2/r2.ts';
import { parseNameValuePairsOption, parseOptionalBooleanOption, parseOptionalStringOption } from './cli_common.ts';
import { loadR2Options } from './cli_r2.ts';
import { CLI_VERSION } from './cli_version.ts';
import { computeMd5 } from "./md5.ts";

export async function putObject(args: (string | number)[], options: Record<string, unknown>) {
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

    const cacheControl = parseOptionalStringOption('cache-control', options);
    const contentDisposition = parseOptionalStringOption('content-disposition', options);
    const contentEncoding = parseOptionalStringOption('content-encoding', options);
    const contentLanguage = parseOptionalStringOption('content-language', options);
    const contentType = parseOptionalStringOption('content-type', options);
    let contentMd5 = parseOptionalStringOption('content-md5', options);
    const shouldComputeContentMd5 = parseOptionalBooleanOption('compute-content-md5', options);

    const expires = parseOptionalStringOption('expires', options);
    const customMetadata = parseNameValuePairsOption('custom', options);

    const computeBody = async () => {
        const { file } = options;
        if (typeof file === 'string') return new Bytes(await Deno.readFile(file));
        throw new Error(`Must provide the --file option`);
    };

    const body = await computeBody();
    
    if (shouldComputeContentMd5) {
        if (contentMd5) throw new Error(`Cannot compute content-md5 if it's already provided`);
        contentMd5 = computeMd5(body, 'base64');
    }
    
    const { origin, region, context } = await loadR2Options(options);

    const response = await putObjectR2({ bucket, key, body, origin, region, cacheControl, contentDisposition, contentEncoding, contentLanguage, contentMd5, expires, contentType, customMetadata }, context);
    console.log(`${response.status} ${computeHeadersString(response.headers)}`);
    if ((response.headers.get('content-type') || '').toLowerCase().includes('text')) {
        console.log(await response.text());
    } else {
        const body = await response.arrayBuffer();
        console.log(`(${body.byteLength} bytes)`);
    }
}

function dumpHelp() {
    const lines = [
        `denoflare-r2-put-object ${CLI_VERSION}`,
        'Put R2 object for a given key',
        '',
        'USAGE:',
        '    denoflare r2 put-object [FLAGS] [OPTIONS] [bucket] [key]',
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
