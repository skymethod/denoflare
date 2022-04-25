import { AwsCallContext, s3Fetch, throwIfUnexpectedStatus } from './r2.ts';

export type DeleteBucketOpts = { bucket: string, origin: string, region: string };

export async function deleteBucket(opts: DeleteBucketOpts, context: AwsCallContext): Promise<void> {
    const { bucket, origin, region } = opts;
    const method = 'DELETE';
    const url = new URL(`${origin}/${bucket}`);

    const res = await s3Fetch({ method, url, region, context });
    await throwIfUnexpectedStatus(res, 204);
}
