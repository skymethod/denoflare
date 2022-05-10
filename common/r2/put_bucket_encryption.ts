import { AwsCallContext, R2, s3Fetch, throwIfUnexpectedStatus } from './r2.ts';

export type PutBucketEncryptionOpts = { bucket: string, origin: string, region: string, sseAlgorithm: string, bucketKeyEnabled: boolean };

export async function putBucketEncryption(opts: PutBucketEncryptionOpts, context: AwsCallContext): Promise<void> {
    const { bucket, sseAlgorithm, bucketKeyEnabled, origin, region } = opts;
    const method = 'PUT';
    const url = new URL(`${origin}/${bucket}/?encryption`);

    const body = computePayload(sseAlgorithm, bucketKeyEnabled);
    if (R2.DEBUG) console.log(body);
    const res = await s3Fetch({ method, url, body, region, context });
    await throwIfUnexpectedStatus(res, 200);

    const txt = await res.text();
    if (R2.DEBUG) console.log(txt);
}

//

const computePayload = (sseAlgorithm: string, bucketKeyEnabled: boolean) => // `<?xml version="1.0" encoding="UTF-8"?> // R2 bug: this endpoint does not support an xml declaration!
`<ServerSideEncryptionConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Rule>
    <ApplyServerSideEncryptionByDefault>
      <SSEAlgorithm>${sseAlgorithm}</SSEAlgorithm>
    </ApplyServerSideEncryptionByDefault>
    <BucketKeyEnabled>${bucketKeyEnabled ? 'true' : 'false'}</BucketKeyEnabled>
  </Rule>
</ServerSideEncryptionConfiguration>`;
