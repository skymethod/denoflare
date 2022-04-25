import { AwsCallContext, s3Fetch } from './r2.ts';

export async function headBucket(opts: { bucket: string, origin: string, region: string }, context: AwsCallContext): Promise<Response> {
    const { bucket, origin, region } = opts;
    const method = 'HEAD';
    const url = new URL(`${origin}/${bucket}`);

    const res = await s3Fetch({ method, url, region, context });
    return res;
}
