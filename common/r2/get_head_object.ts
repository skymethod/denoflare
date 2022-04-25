import { AwsCallContext, s3Fetch, throwIfUnexpectedStatus } from './r2.ts';

export async function getOrHeadObject(opts: { method: 'GET' | 'HEAD', bucket: string, key: string, origin: string, region: string, ifMatch?: string, ifNoneMatch?: string, ifModifiedSince?: string, ifUnmodifiedSince?: string, partNumber?: number, range?: string }, context: AwsCallContext): Promise<Response> {
    const { bucket, key, origin, region, ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince, partNumber, range, method } = opts;
    const url = new URL(`${origin}/${bucket}/${key}`);
    const headers = new Headers();
    if (typeof ifMatch === 'string') headers.set('if-match', ifMatch);
    if (typeof ifNoneMatch === 'string') headers.set('if-none-match', ifNoneMatch);
    if (typeof ifModifiedSince === 'string') headers.set('if-modified-since', ifModifiedSince);
    if (typeof ifUnmodifiedSince === 'string') headers.set('if-unmodified-since', ifUnmodifiedSince);
    if (typeof range === 'string') headers.set('range', range);
    if (typeof partNumber === 'number') url.searchParams.set('partNumber', String(partNumber));

    const res = await s3Fetch({ method, url, headers, region, context });
    await throwIfUnexpectedStatus(res, 200, 304);
    return res;
}
