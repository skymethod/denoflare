import { AwsCallContext, computeBucketUrl, s3Fetch, throwIfUnexpectedStatus, UrlStyle } from './r2.ts';

export type DeleteObjectOpts = { bucket: string, key: string, origin: string, region: string, urlStyle?: UrlStyle, versionId?: string };

export async function deleteObject(opts: DeleteObjectOpts, context: AwsCallContext): Promise<void> {
    const { bucket, key, origin, region, versionId, urlStyle } = opts;
    const method = 'DELETE';
    const url = computeBucketUrl({ origin, bucket, key, urlStyle });
    if (typeof versionId === 'string') url.searchParams.set('versionId', versionId);

    const res = await s3Fetch({ method, url, region, context });
    await throwIfUnexpectedStatus(res, 204);  // r2 returns 204 whether or not the key existed
}
