import { AwsCallContext, computeBucketUrl, s3Fetch, UrlStyle } from './r2.ts';

export type HeadBucketOpts = { bucket: string, origin: string, region: string, urlStyle?: UrlStyle };

export async function headBucket(opts: HeadBucketOpts, context: AwsCallContext): Promise<Response> {
    const { bucket, origin, region, urlStyle } = opts;
    const method = 'HEAD';
    const url = computeBucketUrl({ origin, bucket, urlStyle });

    const res = await s3Fetch({ method, url, region, context });
    return res;
}
