import { AwsCallContext, computeBucketUrl, s3Fetch, throwIfUnexpectedStatus, UrlStyle } from './r2.ts';

export type AbortMultipartUploadOpts = { bucket: string, key: string, uploadId: string, origin: string, region: string, urlStyle?: UrlStyle };

export async function abortMultipartUpload(opts: AbortMultipartUploadOpts, context: AwsCallContext): Promise<void> {
    const { bucket, key, uploadId, origin, region, urlStyle } = opts;
    const method = 'DELETE';
    const url = computeBucketUrl({ origin, bucket, key, urlStyle });
    url.searchParams.set('uploadId', uploadId);

    const res = await s3Fetch({ method, url, region, context });
    await throwIfUnexpectedStatus(res, 204);
}
