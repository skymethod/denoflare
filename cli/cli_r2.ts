import { listObjects, LIST_OBJECTS_COMMAND } from './cli_r2_list_objects.ts';
import { listObjectsV1, LIST_OBJECTS_V1_COMMAND } from './cli_r2_list_objects_v1.ts';
import { getObject, GET_OBJECT_COMMAND, headObject, HEAD_OBJECT_COMMAND } from './cli_r2_get_head_object.ts';
import { commandOptionsForConfig, loadConfig, resolveProfile } from './config_loader.ts';
import { AwsCallBody, AwsCallContext, AwsCredentials, R2, R2_REGION_AUTO, UrlStyle } from '../common/r2/r2.ts';
import { Bytes } from '../common/bytes.ts';
import { listBuckets, LIST_BUCKETS_COMMAND } from './cli_r2_list_buckets.ts';
import { headBucket, HEAD_BUCKET_COMMAND } from './cli_r2_head_bucket.ts';
import { getBucketEncryption, GET_BUCKET_ENCRYPTION_COMMAND } from './cli_r2_get_bucket_encryption.ts';
import { getBucketLocation, GET_BUCKET_LOCATION_COMMAND } from './cli_r2_get_bucket_location.ts';
import { deleteBucketEncryption, DELETE_BUCKET_ENCRYPTION_COMMAND } from './cli_r2_delete_bucket_encryption.ts';
import { putBucketEncryption, PUT_BUCKET_ENCRYPTION_COMMAND } from './cli_r2_put_bucket_encryption.ts';
import { createBucket, CREATE_BUCKET_COMMAND } from './cli_r2_create_bucket.ts';
import { deleteBucket, DELETE_BUCKET_COMMAND } from './cli_r2_delete_bucket.ts';
import { putObject, PUT_OBJECT_COMMAND } from './cli_r2_put_object.ts';
import { deleteObject, DELETE_OBJECT_COMMAND } from './cli_r2_delete_object.ts';
import { deleteObjects, DELETE_OBJECTS_COMMAND } from './cli_r2_delete_objects.ts';
import { copyObject, COPY_OBJECT_COMMAND } from './cli_r2_copy_object.ts';
import { createMultipartUpload, CREATE_MULTIPART_UPLOAD_COMMAND } from './cli_r2_create_multipart_upload.ts';
import { abortMultipartUpload, ABORT_MULTIPART_UPLOAD_COMMAND } from './cli_r2_abort_multipart_upload.ts';
import { completeMultipartUpload, COMPLETE_MULTIPART_UPLOAD_COMMAND } from './cli_r2_complete_multipart_upload.ts';
import { uploadPart, UPLOAD_PART_COMMAND } from './cli_r2_upload_part.ts';
import { uploadPartCopy, UPLOAD_PART_COPY_COMMAND } from './cli_r2_upload_part_copy.ts';
import { putLargeObject } from './cli_r2_put_large_object.ts';
import { CLI_USER_AGENT, denoflareCliCommand, parseOptionalBooleanOption, parseOptionalStringOption } from './cli_common.ts';
import { computeMd5, computeStreamingMd5, computeStreamingSha256 } from './wasm_crypto.ts';
import { checkMatchesReturnMatcher } from '../common/check.ts';
import { ApiR2Bucket } from './api_r2_bucket.ts';
import { verifyToken } from '../common/cloudflare_api.ts';
import { CliCommand, CliCommandModifier } from './cli_command.ts';

export const R2_COMMAND = denoflareCliCommand('r2', 'Manage R2 storage using the S3 compatibility API')
    .subcommand(LIST_BUCKETS_COMMAND, listBuckets)
    .subcommand(HEAD_BUCKET_COMMAND, headBucket)
    .subcommand(CREATE_BUCKET_COMMAND, createBucket)
    .subcommand(DELETE_BUCKET_COMMAND, deleteBucket)
    .subcommand(GET_BUCKET_ENCRYPTION_COMMAND, getBucketEncryption)
    .subcommand(DELETE_BUCKET_ENCRYPTION_COMMAND, deleteBucketEncryption)
    .subcommand(PUT_BUCKET_ENCRYPTION_COMMAND, putBucketEncryption)
    .subcommand(GET_BUCKET_LOCATION_COMMAND, getBucketLocation)

    .subcommandGroup()
    .subcommand(LIST_OBJECTS_COMMAND, listObjects)
    .subcommand(LIST_OBJECTS_V1_COMMAND, listObjectsV1)
    .subcommand(GET_OBJECT_COMMAND, getObject)
    .subcommand(HEAD_OBJECT_COMMAND, headObject)
    .subcommand(PUT_OBJECT_COMMAND, putObject)
    .subcommand(DELETE_OBJECT_COMMAND, deleteObject)
    .subcommand(DELETE_OBJECTS_COMMAND, deleteObjects)
    .subcommand(COPY_OBJECT_COMMAND, copyObject)

    .subcommandGroup()
    .subcommand(CREATE_MULTIPART_UPLOAD_COMMAND, createMultipartUpload)
    .subcommand(ABORT_MULTIPART_UPLOAD_COMMAND, abortMultipartUpload)
    .subcommand(COMPLETE_MULTIPART_UPLOAD_COMMAND, completeMultipartUpload)
    .subcommand(UPLOAD_PART_COMMAND, uploadPart)
    .subcommand(UPLOAD_PART_COPY_COMMAND, uploadPartCopy)
    ;

export async function r2(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    await R2_COMMAND.routeSubcommand(args, options, { putLargeObject, tmp });
}

export function commandOptionsForR2(opts: { hideUrlStyle?: boolean } = {}): CliCommandModifier {
    const { hideUrlStyle } = opts;
    return command => {
        command
            .optionGroup()
            .option('unsignedPayload', 'boolean', 'If set, skip request body signing (and thus verification) for the R2 request');
        if (!hideUrlStyle) command.option('urlStyle', 'enum', 'URL addressing method used in request', { value: 'path' }, { value: 'vhost', default: true }); 
        return command.include(commandOptionsForConfig);
    }
}

export async function loadR2Options(options: Record<string, unknown>): Promise<{ origin: string, region: string, context: AwsCallContext, urlStyle?: UrlStyle }> {
    const config = await loadConfig(options);
    const { accountId, apiToken } = await resolveProfile(config, options);
    const apiTokenId = (await verifyToken(apiToken)).id;

    const credentials: AwsCredentials = {
        accessKey: apiTokenId,
        secretKey: (await Bytes.ofUtf8(apiToken).sha256()).hex(),
    };
    const origin = `https://${accountId}.r2.cloudflarestorage.com`;
    const region = R2_REGION_AUTO;
    const unsignedPayload = parseOptionalBooleanOption('unsigned-payload', options);
    const context = { credentials, userAgent: CLI_USER_AGENT, unsignedPayload };
    const urlStyle = parseOptionalStringOption('url-style', options);
    if (urlStyle !== undefined && urlStyle !== 'path' && urlStyle !== 'vhost') throw new Error(`Bad url-style: ${urlStyle}`);
    return { origin, region, context, urlStyle };
}

export function surroundWithDoubleQuotesIfNecessary(value: string | undefined): string | undefined {
    if (value === undefined) return value;
    if (!value.startsWith('"')) value = '"' + value;
    if (!value.endsWith('"')) value += '"';
    return value;
}

export function commandOptionsForLoadBodyFromOptions(command: CliCommand<unknown>) {
    return command
        .optionGroup()
        .option('contentMd5', 'string', 'Precomputed Content-MD5 of the contents', { hint: 'base64' })
        .option('computeContentMd5', 'boolean', 'If set, automatically compute Content-MD5 of the contents')
        .option('file', 'string', 'Path to the contents', { hint: 'path' })
        .option('filestream', 'string', 'Path to the contents (streaming upload)', { hint: 'path' })
        .option('bytes', 'string', 'Range of local file to upload (e.g. bytes=0-100)')
        ;
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
