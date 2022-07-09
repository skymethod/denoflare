import { Bytes } from '../common/bytes.ts';
import { computeGetOrHeadObjectRequest, GetObjectOpts } from '../common/r2/get_head_object.ts';
import { AwsCall, presignAwsCallV4 } from '../common/r2/r2.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForR2, loadR2Options } from './cli_r2.ts';

export const PRESIGN_COMMAND = denoflareCliCommand(['r2', 'presign'], 'Generate a presigned url for time-limited public access to a private R2 object')
    .arg('bucket', 'string', 'Name of the R2 bucket')
    .arg('key', 'string', 'Key of the object')
    .option('expiresIn', 'integer', 'Number of seconds until the presigned url expires (default: 3600 (one hour), maximum: 604800 (one week))')
    .include(commandOptionsForR2({ hideUnsignedPayload: true }))
    .docsLink('/cli/r2#presign')
    ;

export async function presign(args: (string | number)[], options: Record<string, unknown>) {
    if (PRESIGN_COMMAND.dumpHelp(args, options)) return;

    const { bucket, key, expiresIn: expiresInSeconds = 3600 } = PRESIGN_COMMAND.parse(args, options);

    const { origin, region, context, urlStyle } = await loadR2Options(options);
    const { credentials } = context;

    const opts: GetObjectOpts = {
        bucket, key, origin, region, urlStyle,
    };

    const { url, headers } = computeGetOrHeadObjectRequest(opts);

    const call: AwsCall = {
        method: 'GET',
        url,
        headers,
        body: Bytes.EMPTY,
        region,
        service: 's3',
    };

    const presignedUrl = await presignAwsCallV4(call, { credentials, expiresInSeconds });

    console.log(presignedUrl.toString());
}
