import { Bytes } from '../bytes.ts';
import { AwsCallBody, AwsCallContext, s3Fetch, throwIfUnexpectedStatus } from './r2.ts';

export type UploadPartOpts = { bucket: string, key: string, uploadId: string, partNumber: number, body: AwsCallBody, origin: string, region: string, contentMd5?: string };

export async function uploadPart(opts: UploadPartOpts, context: AwsCallContext): Promise<{ etag: string }> {
    const { bucket, key, uploadId, partNumber, body, origin, region, contentMd5 } = opts;
    const method = 'PUT';
    const url = new URL(`${origin}/${bucket}/${key}`);
    url.searchParams.set('uploadId', uploadId)
    url.searchParams.set('partNumber', String(partNumber));

    const headers = new Headers();
    if (typeof contentMd5 === 'string') headers.set('content-md5', contentMd5);
    
    if (typeof body !== 'string' && !(body instanceof Bytes)) {
        // required only for stream bodies
        headers.set('content-length', String(body.length))
    }

    const res = await s3Fetch({ method, url, headers, body, region, context });
    await throwIfUnexpectedStatus(res, 200);  // r2 returns 200 with content-length: 0
    const contentLength = res.headers.get('content-length') || '0';
    if (contentLength !== '0') throw new Error(`Expected empty response body to upload-part, found: ${await res.text()}`);
    const etag = res.headers.get('etag') || undefined;
    if (etag === undefined) throw new Error(`Expected ETag in the response headers to upload-part`);
    return { etag };
}
