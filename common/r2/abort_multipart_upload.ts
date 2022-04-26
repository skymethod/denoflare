import { AwsCallContext, s3Fetch, throwIfUnexpectedStatus } from './r2.ts';

export type AbortMultipartUploadOpts = { bucket: string, key: string, uploadId: string, origin: string, region: string };

export async function abortMultipartUpload(opts: AbortMultipartUploadOpts, context: AwsCallContext): Promise<void> {
    const { bucket, key, uploadId, origin, region } = opts;
    const method = 'DELETE';
    const url = new URL(`${origin}/${bucket}/${key}`);
    url.searchParams.set('uploadId', uploadId);

    const res = await s3Fetch({ method, url, region, context });
    await throwIfUnexpectedStatus(res, 204);
}
