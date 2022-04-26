import { CLI_VERSION } from './cli_version.ts';
import { listObjects } from './cli_r2_list_objects.ts';
import { getObject, headObject } from './cli_r2_get_head_object.ts';
import { loadConfig, resolveProfile } from './config_loader.ts';
import { AwsCallContext, AwsCredentials } from '../common/r2/r2.ts';
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

        generic,
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
    const context = { credentials, userAgent: `denoflare-cli/${CLI_VERSION}` };
    return { origin, region, context };
}

export function surroundWithDoubleQuotesIfNecessary(value: string | undefined): string | undefined {
    if (value === undefined) return value;
    if (!value.startsWith('"')) value = '"' + value;
    if (!value.endsWith('"')) value += '"';
    return value;
}

//

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
