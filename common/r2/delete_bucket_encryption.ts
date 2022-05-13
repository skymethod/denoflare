import { AwsCallContext, s3Fetch, throwIfUnexpectedStatus } from './r2.ts';

export type DeleteBucketEncryptionOpts = { bucket: string, origin: string, region: string };

export async function deleteBucketEncryption(opts: DeleteBucketEncryptionOpts, context: AwsCallContext): Promise<void> {
    const { bucket, origin, region } = opts;
    const method = 'DELETE';
    const url = new URL(`${origin}/${bucket}/?encryption`);

    const res = await s3Fetch({ method, url, region, context });
    await throwIfUnexpectedStatus(res, 200); // r2 bug: should be 204
}