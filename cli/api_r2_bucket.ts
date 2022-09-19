import { R2Bucket, R2Conditional, R2GetOptions, R2HTTPMetadata, R2ListOptions, R2Object, R2ObjectBody, R2Objects, R2PutOptions, R2Range } from '../common/cloudflare_workers_types.d.ts';
import { Profile } from '../common/config.ts';
import { Bytes } from '../common/bytes.ts';
import { AwsCallBody, AwsCredentials, computeHeadersString, deleteObject, getObject, headObject, ListBucketResultItem, listObjectsV2, putObject, R2, R2_REGION_AUTO } from '../common/r2/r2.ts';
import { checkMatchesReturnMatcher } from '../common/check.ts';
import { verifyToken } from '../common/cloudflare_api.ts';

export class ApiR2Bucket implements R2Bucket {

    private readonly origin: string;
    private readonly credentials: AwsCredentials;
    private readonly bucket;
    private readonly region = R2_REGION_AUTO;
    private readonly userAgent;

    constructor(origin: string, credentials: AwsCredentials, bucket: string, userAgent: string) {
        this.origin = origin;
        this.credentials = credentials;
        this.bucket = bucket;
        this.userAgent = userAgent;
    }

    static async ofProfile(profile: Profile | undefined, bucketName: string, userAgent: string): Promise<ApiR2Bucket> {
        const { accountId, credentials } = await ApiR2Bucket.parseAccountAndCredentials(profile);
        return ApiR2Bucket.ofAccountAndCredentials(accountId, credentials, bucketName, userAgent);
    }

    static async parseAccountAndCredentials(profile: Profile | undefined): Promise<{ accountId: string, credentials: AwsCredentials }> {
        if (!profile) throw new Error('Cannot use a bucketName binding without configuring a profile to use for its credentials');
        const { accountId, apiToken } = profile;
        const apiTokenId = (await verifyToken({ apiToken })).id;
        
        const accessKey = apiTokenId;
        const secretKey = (await Bytes.ofUtf8(apiToken).sha256()).hex();
        return { accountId, credentials: { accessKey, secretKey } };
    }

    static ofAccountAndCredentials(accountId: string, credentials: AwsCredentials, bucketName: string, userAgent: string): ApiR2Bucket {
        const origin = `https://${accountId}.r2.cloudflarestorage.com`;
        return new ApiR2Bucket(origin, credentials, bucketName, userAgent);
    }

    async head(key: string): Promise<R2Object | null> {
        const { origin, credentials, bucket, region, userAgent } = this;
        const acceptEncoding = 'identity'; // otherwise no content-length, etag is returned!
        const res = await headObject({ bucket, key, origin, region, acceptEncoding }, { credentials, userAgent });
        if (!res) return null;
        if (R2.DEBUG) console.log(`${res.status} ${computeHeadersString(res.headers)}`);
        return new HeadersBasedR2Object(res.headers, key);
    }

    get(key: string): Promise<R2ObjectBody | null>;
    get(key: string, options: R2GetOptions): Promise<R2ObjectBody | R2Object | null>;
    async get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | R2Object | null> {
        const { origin, credentials, bucket, region, userAgent } = this;
        const { ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince } = parseOnlyIf(options?.onlyIf);
        const range = computeRangeHeader(options?.range);
        const cleanIfMatch = cleanEtagForR2(ifMatch);
        const cleanIfNoneMatch = cleanEtagForR2(ifNoneMatch);
        const res = await getObject({ bucket, key, origin, region, ifMatch: cleanIfMatch, ifNoneMatch: cleanIfNoneMatch, ifModifiedSince, ifUnmodifiedSince, range }, { credentials, userAgent });
        if (!res) return null;
        if (R2.DEBUG) console.log(`${res.status} ${computeHeadersString(res.headers)}`);
        if (res.status === 304 || res.status === 412) {
            // r2 no longer returns content-length, etag, or last-modified in this case
            // no choice but to do another call
            return await this.head(key);
        }
        return new ResponseBasedR2ObjectBody(res, key);
    }

    async put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object> {
        const { origin, credentials, bucket, region, userAgent } = this;

        let cacheControl: string | undefined;
        let contentDisposition: string | undefined;
        let contentEncoding: string | undefined;
        let contentLanguage: string | undefined;
        let expires: string | undefined;
        let contentMd5: string | undefined;
        let contentType: string | undefined;
        let customMetadata: Record<string, string> | undefined;
        if (options?.httpMetadata instanceof Headers) {
            const headers = options.httpMetadata;
            cacheControl = headers.get('cache-control') || undefined;
            contentDisposition = headers.get('content-disposition') || undefined;
            contentEncoding = headers.get('content-encoding') || undefined;
            contentLanguage = headers.get('content-language') || undefined;
            expires = headers.get('expires') || undefined;
            contentMd5 = headers.get('content-md5') || undefined;
            contentType = headers.get('content-type') || undefined;
            customMetadata = computeCustomMetadataFromHeaders(headers);
            if (Object.keys(customMetadata).length === 0) customMetadata = undefined;
        } else if (options?.httpMetadata) {
            const metadata = options.httpMetadata;
            cacheControl = metadata.cacheControl;
            contentDisposition = metadata.contentDisposition;
            contentEncoding = metadata.contentEncoding;
            contentLanguage = metadata.contentLanguage;
            expires = metadata.cacheExpiry?.toISOString();
            contentType = metadata.contentType;
        }
        if (options?.customMetadata) {
            customMetadata = options.customMetadata;
        }
        if (options?.md5) {
            if (typeof options.md5 === 'string') {
                contentMd5 = Bytes.ofHex(options.md5).base64();
            } else {
                contentMd5 = new Bytes(new Uint8Array(options.md5)).base64();
            }
        }

        const computeBody: () => Promise<AwsCallBody> = async () => {
            if (value === null) return Bytes.EMPTY;
            if (typeof value === 'string') return value;
            if (value instanceof ArrayBuffer) return new Bytes(new Uint8Array(value));
            if (value instanceof Blob) return new Bytes(new Uint8Array(await value.arrayBuffer()));
            if (typeof value === 'object' && 'locked' in value) { // ReadableStream
                return await Bytes.ofStream(value);
            }
            return new Bytes(new Uint8Array(value.buffer)); // ArrayBufferView
        };

        const body = await computeBody();
        await putObject({ bucket, key, body, origin, region, cacheControl, contentDisposition, contentEncoding, contentLanguage, expires, contentMd5, contentType, customMetadata }, { credentials, userAgent });
        const rt = await this.head(key);
        if (!rt) throw new Error(`ApiR2Bucket: put: subsequent HEAD did not return the object`);
        return rt;
    }

    async delete(key: string): Promise<void> {
        const { origin, credentials, bucket, region, userAgent } = this;
        await deleteObject({ bucket, key, origin, region }, { credentials, userAgent });
    }

    async list(options?: R2ListOptions): Promise<R2Objects> {
        const { origin, credentials, bucket, region, userAgent } = this;
        const maxKeys = options?.limit;
        const continuationToken = options?.cursor;
        const delimiter = options?.delimiter;
        const prefix = options?.prefix;
        if ((options?.include || []).length > 0) {
            throw new Error(`ApiR2Bucket: list: include not supported`);
        }
        const result = await listObjectsV2({ bucket, origin, region, maxKeys, continuationToken, delimiter, prefix }, { credentials, userAgent });
        const truncated = result.isTruncated;
        const cursor = result.nextContinuationToken;
        const delimitedPrefixes = [...(result.commonPrefixes || [])];
        const objects = result.contents.map(v => new ListBucketResultItemBasedR2Object(v));
        return { truncated, cursor, delimitedPrefixes, objects };
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

function computeRangeHeader(range?: R2Range): string | undefined {
    if (range === undefined) return undefined;
    if ('suffix' in range) return `bytes=-${range.suffix}`;
    const start = range.offset ?? 0;
    return `bytes=${start}-${typeof range.offset === 'number' ? start + range.offset - 1 : ''}`;   
}

function getExpectedHeader(name: string, headers: Headers): string {
    const rt = headers.get(name) || undefined;
    if (typeof rt === 'string') return rt;
    throw new Error(`Expected ${name} header`);
}

function computeCustomMetadataFromHeaders(headers: Headers): Record<string, string> {
    return Object.fromEntries([...headers.keys()].filter(v => v.startsWith('x-amz-meta-')).map(v => [v.substring(11), headers.get(v)!]));
}

function computeR2RangeFromContentRange(contentRange: string | undefined): { range: R2Range, size?: number } | undefined {
    if (typeof contentRange !== 'string') return undefined;
    const [ _, start, end, sizeStr ] = checkMatchesReturnMatcher('content-range', contentRange, /^bytes (\d+)-(\d+)\/(\d+)$/);
    const offset = parseInt(start);
    const length = parseInt(end) - offset + 1;
    const size = sizeStr !== '*' ? parseInt(sizeStr) : undefined;
    return { range: { offset, length }, size };
}

function cleanEtagForR2(etag: string | undefined) {
    // 2022-09-19: If-None-Match each ETag must be surrounded by double quotes
    const m = /^([a-f0-9]+)$/.exec(etag || '');
    return m ? `"${m[1]}"` : etag;
}

//

class ListBucketResultItemBasedR2Object implements R2Object {
    readonly key: string;
    readonly size: number;
    readonly version: string;
    readonly etag: string;
    readonly httpEtag: string;
    readonly uploaded: Date;
    readonly httpMetadata: R2HTTPMetadata;
    readonly customMetadata: Record<string, string>;

    constructor(item: ListBucketResultItem) {
        this.key = item.key;
        this.size = item.size;
        this.httpEtag = item.etag;
        this.etag = checkMatchesReturnMatcher('etag', this.httpEtag, /^"([0-9a-f]{32})"$/)[1];
        this.uploaded = new Date(item.lastModified);

        // placeholder values, don't throw on prop access
        this.version = this.etag;
        this.httpMetadata = {};
        this.customMetadata = {};
    }

    writeHttpMetadata(_headers: Headers): void { throw new Error(`writeHttpMetadata not supported`); }
}

class HeadersBasedR2Object implements R2Object {
    readonly key: string;
    readonly _size: number | undefined; get size() { if (typeof this._size === 'number') return this._size; throw new Error(`Did not get a size in the headers response`); }
    readonly version: string;
    readonly etag: string;
    readonly httpEtag: string;
    readonly uploaded: Date;
    readonly httpMetadata: R2HTTPMetadata;
    readonly customMetadata: Record<string, string>;
    readonly range?: R2Range;

    constructor(headers: Headers, key: string) {
        this.key = key;
        const parsed = computeR2RangeFromContentRange(headers.get('content-range') || undefined);
        if (parsed) {
            this.range = parsed.range;
        }
        const contentLength = headers.get('content-length') ?? undefined;
        this._size = parsed && typeof parsed.size === 'number' ? parsed.size : contentLength ? parseInt(contentLength) : undefined;
        this.httpEtag = getExpectedHeader('etag', headers);
        this.etag = checkMatchesReturnMatcher('etag', this.httpEtag, /^(W\/)?"([0-9a-f]{32})"$/)[1];
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
        this.customMetadata = computeCustomMetadataFromHeaders(headers);

        // placeholder values, don't throw on prop access
        this.version = this.etag;
    }

    writeHttpMetadata(_headers: Headers): void { throw new Error(`writeHttpMetadata not supported`); }
}

class ResponseBasedR2ObjectBody extends HeadersBasedR2Object implements R2ObjectBody {
    get body(): ReadableStream { if (this.response.body === null) throw new Error('Unexpected null response body'); return this.response.body; }
    get bodyUsed(): boolean { return this.response.bodyUsed; }

    private readonly response: Response;

    constructor(response: Response, key: string) {
        super(response.headers, key);
        this.response = response;
    }

    arrayBuffer(): Promise<ArrayBuffer> {
        return this.response.arrayBuffer();
    }

    text(): Promise<string> {
        return this.response.text();
    }

    json<T>(): Promise<T> {
        return this.response.json();
    }

    blob(): Promise<Blob> {
        return this.response.blob();
    }

}
