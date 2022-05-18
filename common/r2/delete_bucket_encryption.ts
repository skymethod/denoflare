import { AwsCallContext, computeBucketUrl, s3Fetch, throwIfUnexpectedStatus, UrlStyle } from './r2.ts';

export type DeleteBucketEncryptionOpts = { bucket: string, origin: string, region: string, urlStyle?: UrlStyle };

export async function deleteBucketEncryption(opts: DeleteBucketEncryptionOpts, context: AwsCallContext): Promise<void> {
    const { bucket, origin, region, urlStyle } = opts;
    const method = 'DELETE';
    const url = computeBucketUrl({ origin, bucket, urlStyle, subresource: 'encryption' });

    const res = await s3Fetch({ method, url, region, context });
    await throwIfUnexpectedStatus(res, 200); // r2 bug: should be 204
}
