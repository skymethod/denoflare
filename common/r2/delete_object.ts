import { AwsCallContext, s3Fetch, throwIfUnexpectedStatus } from './r2.ts';

export type DeleteObjectOpts = { bucket: string, key: string, origin: string, region: string, versionId?: string };

export async function deleteObject(opts: DeleteObjectOpts, context: AwsCallContext): Promise<void> {
    const { bucket, key, origin, region, versionId } = opts;
    const method = 'DELETE';
    const url = new URL(`${origin}/${bucket}/${key}`);
    if (typeof versionId === 'string') url.searchParams.set('versionId', versionId);

    const res = await s3Fetch({ method, url, region, context });
    await throwIfUnexpectedStatus(res, 204);  // r2 returns 204 whether or not the key existed
}
