import { CLI_VERSION } from './cli_version.ts';
import { listObjects } from './cli_r2_list_objects.ts';
import { getObject, headObject } from './cli_r2_get_head_object.ts';
import { loadConfig, resolveProfile } from './config_loader.ts';
import { AwsCallBody, AwsCallContext, AwsCredentials, R2 } from '../common/r2/r2.ts';
import { Bytes } from '../common/bytes.ts';
import { listBuckets } from './cli_r2_list_buckets.ts';
import { headBucket } from './cli_r2_head_bucket.ts';
import { createBucket } from './cli_r2_create_bucket.ts';
import { deleteBucket } from './cli_r2_delete_bucket.ts';
import { generic } from './cli_r2_generic.ts';
import { putObject } from './cli_r2_put_object.ts';
import { deleteObject } from './cli_r2_delete_object.ts';
import { deleteObjects } from './cli_r2_delete_objects.ts';
import { copyObject } from './cli_r2_copy_object.ts';
import { createMultipartUpload } from './cli_r2_create_multipart_upload.ts';
import { abortMultipartUpload } from './cli_r2_abort_multipart_upload.ts';
import { completeMultipartUpload } from './cli_r2_complete_multipart_upload.ts';
import { uploadPart } from './cli_r2_upload_part.ts';
import { uploadPartCopy } from './cli_r2_upload_part_copy.ts';
import { putLargeObject } from './cli_r2_put_large_object.ts';
import { CLI_USER_AGENT, parseOptionalBooleanOption, parseOptionalStringOption } from './cli_common.ts';
import { computeMd5, computeStreamingMd5, computeStreamingSha256 } from './wasm_crypto.ts';
import { checkMatchesReturnMatcher } from '../common/check.ts';
import { ApiR2Bucket } from './api_r2_bucket.ts';

export async function r2(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    const subcommand = args[0];
    if (options.help && args.length === 0 || typeof subcommand !== 'string') {
        dumpHelp();
        return;
    }

    const fn = { 
        'list-buckets': listBuckets, 
        'head-bucket': headBucket,
        'create-bucket': createBucket, 
        'delete-bucket': deleteBucket, 

        'list-objects': listObjects, 
        'get-object': getObject, 
        'head-object': headObject,
        'put-object': putObject,
        'delete-object': deleteObject,
        'delete-objects': deleteObjects,
        'copy-object': copyObject,

        'create-multipart-upload': createMultipartUpload,
        'abort-multipart-upload': abortMultipartUpload,
        'complete-multipart-upload': completeMultipartUpload,
        'upload-part': uploadPart,
        'upload-part-copy': uploadPartCopy,

        generic,
        'put-large-object': putLargeObject,
        tmp,

     }[subcommand];
    if (fn) {
        await fn(args.slice(1), options);
    } else {
        dumpHelp();
    }
}

export async function loadR2Options(options: Record<string, unknown>): Promise<{ origin: string, region: string, context: AwsCallContext }> {
    const config = await loadConfig(options);
    const { accountId, apiToken, apiTokenId } = await resolveProfile(config, options);
    if (!apiTokenId) throw new Error(`Profile needs an apiTokenId to use the S3 API for R2`);

    const credentials: AwsCredentials = {
        accessKey: apiTokenId,
        secretKey: (await Bytes.ofUtf8(apiToken).sha256()).hex(),
    };
    const origin = `https://${accountId}.r2.cloudflarestorage.com`;
    const region = 'world'
    const unsignedPayload = parseOptionalBooleanOption('unsigned-payload', options);
    const context = { credentials, userAgent: CLI_USER_AGENT, unsignedPayload };

    return { origin, region, context,  };
}

export function surroundWithDoubleQuotesIfNecessary(value: string | undefined): string | undefined {
    if (value === undefined) return value;
    if (!value.startsWith('"')) value = '"' + value;
    if (!value.endsWith('"')) value += '"';
    return value;
}

export async function loadBodyFromOptions(options: Record<string, unknown>, unsignedPayload: boolean | undefined): Promise<{ body: AwsCallBody, contentMd5?: string }> {
    let contentMd5 = parseOptionalStringOption('content-md5', options);
    const shouldComputeContentMd5 = parseOptionalBooleanOption('compute-content-md5', options);

    const start = Date.now();
    let prepMillis = 0;
    const computeBody: () => Promise<AwsCallBody> = async () => {
        const { file, filestream } = options;
        try {
            if (typeof file === 'string') {
                const bytes = parseOptionalStringOption('bytes', options);
                let startByte: number | undefined;
                let endByte: number | undefined;
                if (typeof bytes === 'string') {
                    const m = checkMatchesReturnMatcher('bytes', bytes, /^(\d+)-(\d*)$/);
                    if (!m) throw new Error(`Bad bytes: ${bytes}`);
                    startByte = parseInt(m[1]);
                    if (m[2] !== '') endByte = parseInt(m[2]);
                    if (typeof endByte === 'number' && startByte > endByte) throw new Error(`Bad bytes: ${bytes}`);
                }
                let rt = new Bytes(await Deno.readFile(file));
                if (typeof startByte === 'number') {
                    rt = new Bytes(rt.array().slice(startByte, typeof endByte === 'number' ? (endByte + 1) : undefined));
                    console.log(rt.length);
                }
                return rt;
            }
            if (typeof filestream === 'string') {
                
                const stat = await Deno.stat(filestream);
                if (!stat.isFile) throw new Error(`--file must point to a file`);
                const length = stat.size;

                const f1 = await Deno.open(filestream);
                const sha256Hex = unsignedPayload ? 'UNSIGNED-PAYLOAD' : (await computeStreamingSha256(f1.readable)).hex();

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
    return { body, contentMd5 };
}

//

async function tmp(args: (string | number)[], options: Record<string, unknown>) {
    const [ bucketName, key ] = args;
    if (typeof bucketName !== 'string') throw new Error();
    if (typeof key !== 'string') throw new Error();

    const verbose = !!options.verbose;
    if (verbose) {
        R2.DEBUG = true;
    }
    
    const config = await loadConfig(options);
    const profile = await resolveProfile(config, options);
    const bucket = await ApiR2Bucket.ofProfile(profile, bucketName, CLI_USER_AGENT);
    const { body } = await fetch('https://yahoo.com');
    const res = await bucket.put(key, body);
    console.log(res);
    // if (res) console.log(await res.text());
}

function dumpHelp() {
    const lines = [
        `denoflare-r2 ${CLI_VERSION}`,
        'Manage R2 storage using the S3 compatibility API',
        '',
        'USAGE:',
        '    denoflare r2 [subcommand] [FLAGS] [OPTIONS] [args]',
        '',
        'SUBCOMMANDS:',
        '    list-objects    List objects within a bucket',
        '    get-object      Get R2 object for a given key',
        '',
        'For subcommand-specific help: denoflare site [subcommand] --help',
    ];
    for (const line of lines) {
        console.log(line);
    }
}

