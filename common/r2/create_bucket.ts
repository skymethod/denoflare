import { AwsCallContext, s3Fetch, throwIfUnexpectedStatus } from './r2.ts';

export type CreateBucketOpts = { bucket: string, origin: string, region: string };

export async function createBucket(opts: CreateBucketOpts, context: AwsCallContext): Promise<{ location: string }> {
    const { bucket, origin, region } = opts;
    const method = 'PUT';
    const url = new URL(`${origin}/${bucket}`);

    const body = payload(region);
    const res = await s3Fetch({ method, url, region, context, body });
    await throwIfUnexpectedStatus(res, 200);

    const location = res.headers.get('location') || undefined;
    if (location === undefined) throw new Error(`Missing expected 'location' header in response`);
    return { location };
}

//

const payload = (locationConstraint: string) => `<?xml version="1.0" encoding="UTF-8"?>
<CreateBucketConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <LocationConstraint>${locationConstraint}</LocationConstraint>
</CreateBucketConfiguration>`;
