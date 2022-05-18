import { AwsCallContext, computeBucketUrl, s3Fetch, throwIfUnexpectedStatus, UrlStyle } from './r2.ts';

export type DeleteBucketOpts = { bucket: string, origin: string, region: string, urlStyle?: UrlStyle };

export async function deleteBucket(opts: DeleteBucketOpts, context: AwsCallContext): Promise<void> {
    const { bucket, origin, region, urlStyle } = opts;
    const method = 'DELETE';
    const url = computeBucketUrl({ origin, bucket, urlStyle });

    const res = await s3Fetch({ method, url, region, context });
    await throwIfUnexpectedStatus(res, 204);
}
