import { R2Bucket, R2Conditional, R2GetOptions, R2HeadOptions, R2HTTPMetadata, R2ListOptions, R2Object, R2ObjectBody, R2Objects, R2PutOptions } from '../common/cloudflare_workers_types.d.ts';
import { Profile } from '../common/config.ts';
import { Bytes } from '../common/bytes.ts';
import { AwsCredentials, computeHeadersString, headObject } from '../common/r2/r2.ts';
import { checkMatchesReturnMatcher } from '../common/check.ts';

export class ApiR2Bucket implements R2Bucket {

    private readonly origin: string;
    private readonly credentials: AwsCredentials;
    private readonly bucket;
    private readonly region = 'world';
    private readonly userAgent;

    constructor(origin: string, credentials: AwsCredentials, bucket: string, userAgent: string) {
        this.origin = origin;
        this.credentials = credentials;
        this.bucket = bucket;
        this.userAgent = userAgent;
    }

    static async ofProfile(profile: Profile | undefined, bucketName: string, userAgent: string): Promise<ApiR2Bucket> {
        if (!profile) throw new Error('Cannot use a bucketName binding without configuring a profile to use for its credentials');
        const { accountId, apiToken, apiTokenId } = profile;
        if (!apiTokenId) throw new Error('Cannot use a bucketName binding without configuring a profile with an apiTokenId to use for its credentials');

        const origin = `https://${accountId}.r2.cloudflarestorage.com`;
        const accessKey = apiTokenId;
        const secretKey = (await Bytes.ofUtf8(apiToken).sha256()).hex();
        return new ApiR2Bucket(origin, { accessKey, secretKey }, bucketName, userAgent);
    }

    async head(key: string, options?: R2HeadOptions): Promise<R2Object | null> {
        const { origin, credentials, bucket, region, userAgent } = this;
        const { ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince } = parseOnlyIf(options?.onlyIf);
        const { status, headers } = await headObject({ bucket, key, origin, region, ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince }, { credentials, userAgent });
        console.log(`${status} ${computeHeadersString(headers)}`);
        if (status === 404) return null;
        return new HeadersBasedR2Object(headers, key);
    }

    get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null> {
        throw new Error(`ApiR2Bucket.get not implemented key=${key} options=${JSON.stringify(options)}`);
    }

    put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null, options?: R2PutOptions): Promise<R2Object> {
        throw new Error(`ApiR2Bucket.put not implemented key=${key} value=${value} options=${JSON.stringify(options)}`);
    }

    delete(key: string): Promise<void> {
        throw new Error(`ApiR2Bucket.delete not implemented key=${key}`);
    }

    list(options?: R2ListOptions): Promise<R2Objects> {
        throw new Error(`ApiR2Bucket.list not implemented options=${JSON.stringify(options)}`);
    }

}

//

function parseOnlyIf(onlyIf?: R2Conditional | Headers): { ifMatch?: string, ifNoneMatch?: string, ifModifiedSince?: string, ifUnmodifiedSince?: string } {
    let ifMatch: string | undefined;
    let ifNoneMatch: string | undefined;
    let ifModifiedSince: string | undefined;
    let ifUnmodifiedSince: string | undefined;

    if (onlyIf instanceof Headers) {
        ifMatch = onlyIf.get('if-match') || undefined;
        ifNoneMatch = onlyIf.get('if-none-match') || undefined;
        ifModifiedSince = onlyIf.get('if-modified-since') || undefined;
        ifUnmodifiedSince = onlyIf.get('if-unmodified-since') || undefined;
    } else if (onlyIf !== undefined) {
        ifMatch = onlyIf.etagMatches;
        ifNoneMatch = onlyIf.etagDoesNotMatch;
        ifModifiedSince = onlyIf.uploadedAfter?.toISOString();
        ifUnmodifiedSince = onlyIf.uploadedBefore?.toISOString();
    }
    return { ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince };
}

function getExpectedHeader(name: string, headers: Headers): string {
    const rt = headers.get(name) || undefined;
    if (typeof rt === 'string') return rt;
    throw new Error(`Expected ${name} header`);
}

//

class HeadersBasedR2Object implements R2Object {
    readonly key: string;
    readonly size: number;
    get version(): string { throw new Error(`version not supported`); }
    readonly etag: string;
    readonly httpEtag: string;
    readonly uploaded: Date;
    readonly httpMetadata: R2HTTPMetadata;
    readonly customMetadata: Record<string, string>;

    constructor(headers: Headers, key: string) {
        this.key = key;
        const size = getExpectedHeader('content-length', headers);
        this.size = parseInt(size);
        this.httpEtag = getExpectedHeader('etag', headers);
        this.etag = checkMatchesReturnMatcher('etag', this.httpEtag, /^"([0-9a-f]{32})"$/)[1];
        const lastModified = getExpectedHeader('last-modified', headers);
        this.uploaded = new Date(lastModified);
        const cacheExpiryStr = headers.get('cache-expiry') || undefined;
        this.httpMetadata = {
            contentType: headers.get('content-type') || undefined,
            contentLanguage: headers.get('content-language') || undefined,
            contentDisposition: headers.get('content-disposition') || undefined,
            contentEncoding: headers.get('content-encoding') || undefined,
            cacheControl: headers.get('cache-control') || undefined,
            cacheExpiry: cacheExpiryStr ? new Date(cacheExpiryStr) : undefined,
        }
        this.customMetadata = Object.fromEntries([...headers.keys()].filter(v => v.startsWith('x-amz-meta-')).map(v => [v.substring(11), headers.get(v)!]));
    }

    writeHttpMetadata(_headers: Headers): void { throw new Error(`writeHttpMetadata not supported`); }
}
