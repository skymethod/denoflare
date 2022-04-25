import { AwsCallContext, s3Fetch, throwIfUnexpectedStatus } from './r2.ts';

export async function createBucket(opts: { bucket: string, origin: string, region: string }, context: AwsCallContext): Promise<void> {
    const { bucket, origin, region } = opts;
    const method = 'PUT';
    const url = new URL(`${origin}/${bucket}`);

    const body = payload;
    const res = await s3Fetch({ method, url, region, context, body });
    await throwIfUnexpectedStatus(res, 200);

    // R2 does not return a location header
}

//

const payload = `<?xml version="1.0" encoding="UTF-8"?>
<CreateBucketConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
</CreateBucketConfiguration>`;
