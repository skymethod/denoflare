import { Bytes } from '../common/bytes.ts';
import { AwsCallBody, computeAwsCallBodyLength, putObject as putObjectR2, R2 } from '../common/r2/r2.ts';
import { CliStats, parseNameValuePairsOption, parseOptionalBooleanOption, parseOptionalStringOption } from './cli_common.ts';
import { loadR2Options } from './cli_r2.ts';
import { CLI_VERSION } from './cli_version.ts';
import { computeStreamingMd5, computeStreamingSha256, computeMd5 } from './wasm_crypto.ts';

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

    const start = Date.now();
    let prepMillis = 0;
    const computeBody: () => Promise<AwsCallBody> = async () => {
        const { file, filestream } = options;
        try {
            if (typeof file === 'string') {
                return new Bytes(await Deno.readFile(file));
            }
            if (typeof filestream === 'string') {
                
                const stat = await Deno.stat(filestream);
                if (!stat.isFile) throw new Error(`--file must point to a file`);
                const length = stat.size;

                const f1 = await Deno.open(filestream);
                const sha256Hex = (await computeStreamingSha256(f1.readable)).hex();

                let md5Base64: string | undefined;
                if (shouldComputeContentMd5) {
                    const f2 = await Deno.open(filestream);
                    md5Base64 = (await computeStreamingMd5(f2.readable)).base64();
                }

                const f3 = await Deno.open(filestream);
                return { stream: f3.readable, sha256Hex, length, md5Base64 };
            }
            throw new Error(`Must provide the --file or --filestream option`);
        } finally {
            prepMillis = Date.now() - start;
        }
    };

    const body = await computeBody();
    
    if (shouldComputeContentMd5) {
        if (contentMd5) throw new Error(`Cannot compute content-md5 if it's already provided`);
        const start = Date.now();
        if (typeof body === 'string' || body instanceof Bytes) {
            contentMd5 = (await computeMd5(body)).base64();
        } else {
            if (!body.md5Base64) throw new Error(`Cannot compute content-md5 if the stream source does not provide it`);
            contentMd5 = body.md5Base64;
        }
        prepMillis += Date.now() - start;
    }
    console.log(`prep took ${prepMillis}ms`);
    
    const { origin, region, context } = await loadR2Options(options);

    await putObjectR2({ bucket, key, body, origin, region, cacheControl, contentDisposition, contentEncoding, contentLanguage, contentMd5, expires, contentType, customMetadata }, context);
    const millis = Date.now() - CliStats.launchTime;
    console.log(`put ${computeAwsCallBodyLength(body)} bytes in ${millis}ms`);
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
