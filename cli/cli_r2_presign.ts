import { Bytes } from '../common/bytes.ts';
import { checkOrigin } from '../common/check.ts';
import { computeGetOrHeadObjectRequest, GetObjectOpts } from '../common/r2/get_head_object.ts';
import { AwsCall, presignAwsCallV4 } from '../common/r2/r2.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForR2, loadR2Options, loadR2OptionsForCredentials, R2Options } from './cli_r2.ts';

export const PRESIGN_COMMAND = denoflareCliCommand(['r2', 'presign'], 'Generate a presigned url for time-limited public access to a private R2 object')
    .arg('bucket', 'string', 'Name of the R2 bucket')
    .arg('key', 'string', 'Key of the object')
    .option('expiresIn', 'integer', 'Number of seconds until the presigned url expires (default: 3600 (one hour), maximum: 604800 (one week))')
    .option('endpointOrigin', 'string', 'Custom origin to use for vhost-style requests (e.g. https://mydomain.com), signed url will use the bucketname as a subdomain (e.g. https://mybucket.mydomain.com)', { hint: 'origin' })
    .option('accessKey', 'string', 'Custom access-key to use when using a custom --endpoint-origin')
    .option('secretKey', 'string', 'Custom secret-key to use when using a custom --endpoint-origin')
    .include(commandOptionsForR2({ hideUnsignedPayload: true }))
    .docsLink('/cli/r2#presign')
    ;

export async function presign(args: (string | number)[], options: Record<string, unknown>) {
    if (PRESIGN_COMMAND.dumpHelp(args, options)) return;

    const { bucket, key, expiresIn: expiresInSeconds = 3600, endpointOrigin, accessKey, secretKey } = PRESIGN_COMMAND.parse(args, options);

    let r2Options: R2Options;
    if (typeof endpointOrigin === 'string') {
        checkOrigin('endpoint-origin', endpointOrigin);
        if (typeof accessKey === 'string' && typeof secretKey === 'string') {
            r2Options = loadR2OptionsForCredentials({ accessKey, secretKey }, endpointOrigin, options);
        } else {
            if (typeof accessKey === 'string' || typeof secretKey === 'string') throw new Error('Either specify both --access-key and --secret-key, or neither');
            r2Options = await loadR2Options(options);
            r2Options = { ...r2Options, origin: endpointOrigin };
        }
        if (r2Options.urlStyle === 'path') throw new Error(`Bad url-style: path, must be vhost (or unset) when specifying --endpoint-origin`);
    } else {
        if (typeof accessKey === 'string') throw new Error(`Can only use --access-key with a custom --endpoint-origin`);
        if (typeof secretKey === 'string') throw new Error(`Can only use --secret-key with a custom --endpoint-origin`);
        r2Options = await loadR2Options(options);
    }
   
    const { urlStyle, region, origin, context: { credentials } } = r2Options;

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
