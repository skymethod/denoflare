import { R2Bucket, R2Checksums, R2GetOptions, R2HTTPMetadata, R2ListOptions, R2MultipartOptions, R2MultipartUpload, R2Object, R2ObjectBody, R2Objects, R2PutOptions, R2UploadedPart } from './cloudflare_workers_types.d.ts';
import { RpcChannel } from './rpc_channel.ts';
import { Bodies, BodyResolver } from './rpc_fetch.ts';
import { Bytes } from './bytes.ts';
import { PackedR2GetOptions, PackedR2MultipartOptions, PackedR2Object, PackedR2Objects, PackedR2PutOptions, packR2GetOptions, packR2MultipartOptions, packR2Object, packR2Objects, packR2PutOptions, unpackR2GetOptions, unpackR2MultipartOptions, unpackR2Object, unpackR2Objects, unpackR2PutOptions } from './rpc_r2_model.ts';

export function addRequestHandlerForRpcR2Bucket(channel: RpcChannel, bodies: Bodies, bodyResolver: BodyResolver, r2BucketResolver: (bucketName: string) => R2Bucket) {
    channel.addRequestHandler('r2-bucket-list', async requestData => {
        const { bucketName, options } = requestData as R2BucketListRequest;
        const target = r2BucketResolver(bucketName);

        const objects = packR2Objects(await target.list(options));

        const res: R2BucketListResponse = { objects };
        return res;
    });
    channel.addRequestHandler('r2-bucket-delete', async requestData => {
        const { bucketName, keys } = requestData as R2BucketDeleteRequest;
        const target = r2BucketResolver(bucketName);

        await target.delete(keys);
        return {};
    });
    channel.addRequestHandler('r2-bucket-head', async requestData => {
        const { bucketName, key } = requestData as R2BucketHeadRequest;
        const target = r2BucketResolver(bucketName);

        const object = await target.head(key);
        const packedObject = object ? packR2Object(object) : undefined;

        const res: R2BucketHeadResponse = { object: packedObject };
        return res;
    });
    channel.addRequestHandler('r2-bucket-get', async requestData => {
        const { bucketName, key, options: packedOptions } = requestData as R2BucketGetRequest;
        const target = r2BucketResolver(bucketName);

        const options = packedOptions === undefined ? undefined : unpackR2GetOptions(packedOptions);
        const object = options ? await target.get(key, options) : await target.get(key);

        let result: { object: PackedR2Object, bodyId?: number } | undefined;
        if (object) {
            result = {
                object: packR2Object(object),
                bodyId: isR2ObjectBody(object) ? bodies.computeBodyId(object.body)! : undefined,
            }
        }
        const res: R2BucketGetResponse = { result };
        return res;
    });
    channel.addRequestHandler('r2-bucket-put', async requestData => {
        const { bucketName, key, options: packedOptions, bodyId, bodyText, bodyBytes, bodyNull } = requestData as R2BucketPutRequest;
        const target = r2BucketResolver(bucketName);

        const options = packedOptions === undefined ? undefined : unpackR2PutOptions(packedOptions);

        const body = bodyNull ? null
            : bodyText ? bodyText
            : bodyBytes ? bodyBytes
            : bodyId ? bodyResolver(bodyId)
            : undefined;
        if (body === undefined) throw new Error(`RpcR2Bucket: Unable to compute body!`);

        const object = await target.put(key, body, options);

        const res: R2BucketPutResponse = { object: packR2Object(object) };
        return res;
    });
    channel.addRequestHandler('r2-bucket-create-multipart-upload', async requestData => {
        const { bucketName, key, options: packedOptions } = requestData as R2BucketCreateMultipartUploadRequest;
        const target = r2BucketResolver(bucketName);

        const options = packedOptions === undefined ? undefined : unpackR2MultipartOptions(packedOptions);
        const { uploadId } = await target.createMultipartUpload(key, options);
        const res: R2BucketMultipartUploadResponse = { key, uploadId };
        return res;
    });
    channel.addRequestHandler('r2-bucket-resume-multipart-upload', async requestData => {
        const { bucketName, key, uploadId } = requestData as R2BucketResumeMultipartUploadRequest;
        const target = r2BucketResolver(bucketName);

        await target.resumeMultipartUpload(key, uploadId);
        const res: R2BucketMultipartUploadResponse = { key, uploadId };
        return res;
    });
    channel.addRequestHandler('r2-mpu-upload-part', async requestData => {
        const { bucketName, key, uploadId, partNumber, bodyId, bodyText, bodyBytes, bodyNull } = requestData as R2MpuUploadPartRequest;
        const target = r2BucketResolver(bucketName);

        const body = bodyNull ? null
            : bodyText ? bodyText
            : bodyBytes ? bodyBytes
            : bodyId ? bodyResolver(bodyId)
            : undefined;
        if (body === undefined) throw new Error(`RpcR2Bucket: Unable to compute body!`);

        const upload = await target.resumeMultipartUpload(key, uploadId);
        const { etag } = await upload.uploadPart(partNumber, body);

        const res: R2UploadedPart = { partNumber, etag };
        return res;
    });
    channel.addRequestHandler('r2-mpu-abort', async requestData => {
        const { bucketName, key, uploadId } = requestData as R2MpuAbortRequest;
        const target = r2BucketResolver(bucketName);

        const upload = await target.resumeMultipartUpload(key, uploadId);
        await upload.abort();
    });
    channel.addRequestHandler('r2-mpu-complete', async requestData => {
        const { bucketName, key, uploadId, uploadedParts } = requestData as R2MpuCompleteRequest;
        const target = r2BucketResolver(bucketName);

        const upload = await target.resumeMultipartUpload(key, uploadId);
        const object = await upload.complete(uploadedParts);

        const res: R2BucketPutResponse = { object: packR2Object(object) };
        return res;
    });
}

export class RpcR2Bucket implements R2Bucket {

    private readonly bucketName: string;
    private readonly channel: RpcChannel;
    private readonly bodyResolver: BodyResolver;
    private readonly bodies: Bodies;

    constructor(bucketName: string, channel: RpcChannel, bodyResolver: BodyResolver, bodies: Bodies) {
        this.bucketName = bucketName;
        this.channel = channel;
        this.bodyResolver = bodyResolver;
        this.bodies = bodies;
    }

    async list(options?: R2ListOptions): Promise<R2Objects> {
        const { bucketName } = this;
        const req: R2BucketListRequest = { bucketName, options };
        return await this.channel.sendRequest('r2-bucket-list', req, responseData => {
            const { objects: packedObjects } = responseData as R2BucketListResponse;
            return unpackR2Objects(packedObjects);
        });
    }

    async head(key: string): Promise<R2Object | null> {
        const { bucketName } = this;
        const req: R2BucketHeadRequest = { bucketName, key };
        return await this.channel.sendRequest('r2-bucket-head', req, responseData => {
            const { object: packedObject } = responseData as R2BucketHeadResponse;
            return packedObject === undefined ? null : unpackR2Object(packedObject);
        });
    }

    get(key: string): Promise<R2ObjectBody | null>;
    get(key: string, options: R2GetOptions): Promise<R2ObjectBody | R2Object | null>;
    async get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | R2Object | null> {
        const { bucketName } = this;
        const req: R2BucketGetRequest = { bucketName, key, options: options === undefined ? undefined : packR2GetOptions(options) };
        return await this.channel.sendRequest('r2-bucket-get', req, responseData => {
            const { result } = responseData as R2BucketGetResponse;
            if (result === undefined) return null;
            const { object, bodyId } = result;
            if (typeof bodyId === 'number') {
                const stream = this.bodyResolver(bodyId);
                return new RpcR2ObjectBody(unpackR2Object(object), stream);
            } else {
                return unpackR2Object(object);
            }
        });
    }
    
    async put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object> {
        const { bucketName, bodies } = this;

        const { bodyId, bodyText, bodyBytes, bodyNull } = await packPutValue(value, bodies);

        const req: R2BucketPutRequest = { bucketName, key, options: options === undefined ? undefined : packR2PutOptions(options), bodyId, bodyText, bodyBytes, bodyNull };
        return await this.channel.sendRequest('r2-bucket-put', req, responseData => {
            const { object: packedObject } = responseData as R2BucketPutResponse;
            return unpackR2Object(packedObject);
        });
    }

    async delete(keys: string | string[]): Promise<void> {
        const { bucketName } = this;
        const req: R2BucketDeleteRequest = { bucketName, keys };
        await this.channel.sendRequest('r2-bucket-delete', req, () => { });
    }

    async createMultipartUpload(key: string, options?: R2MultipartOptions): Promise<R2MultipartUpload> {
        const { bucketName, bodies, channel } = this;

        const req: R2BucketCreateMultipartUploadRequest = { bucketName, key, options: options === undefined ? undefined : packR2MultipartOptions(options) };
        return await this.channel.sendRequest('r2-bucket-create-multipart-upload', req, responseData => {
            const { key, uploadId } = responseData as R2BucketMultipartUploadResponse;
            return new RpcR2MultipartUpload(bucketName, bodies, channel, key, uploadId);
        });
    }

    async resumeMultipartUpload(key: string, uploadId: string): Promise<R2MultipartUpload> {
        const { bucketName, bodies, channel } = this;

        const req: R2BucketResumeMultipartUploadRequest = { bucketName, key, uploadId };
        return await this.channel.sendRequest('r2-bucket-resume-multipart-upload', req, responseData => {
            const { key, uploadId } = responseData as R2BucketMultipartUploadResponse;
            return new RpcR2MultipartUpload(bucketName, bodies, channel, key, uploadId);
        });
    }
}

//

function isR2ObjectBody(obj: R2Object): obj is R2ObjectBody {
    return 'body' in obj;
}

async function packPutValue(value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, bodies: Bodies): Promise<{ bodyId: number | undefined, bodyText: string | undefined, bodyBytes: Uint8Array | undefined, bodyNull: boolean }> {
    let bodyId: number | undefined;
    let bodyText: string | undefined;
    let bodyBytes: Uint8Array | undefined;
    let bodyNull = false;
    if (value === null) {
        bodyNull = true;
    } else if (typeof value === 'string') {
        bodyText = value;
    } else if (value instanceof ArrayBuffer) {
        bodyBytes = new Uint8Array(value);
    } else if (value instanceof Blob) {
        bodyBytes = new Uint8Array(await value.arrayBuffer());
    } else if (value instanceof ReadableStream) {
        bodyId = bodies.computeBodyId(value);
    } else {
        bodyBytes = new Uint8Array(value.buffer);
    }
    return { bodyId, bodyText, bodyBytes, bodyNull };
}

//

interface R2BucketListRequest {
    readonly bucketName: string;
    readonly options?: R2ListOptions;
}

interface R2BucketListResponse {
    readonly objects: PackedR2Objects;
}

interface R2BucketDeleteRequest {
    readonly bucketName: string;
    readonly keys: string | string[];
}

interface R2BucketHeadRequest {
    readonly bucketName: string;
    readonly key: string;
}

interface R2BucketHeadResponse {
    readonly object?: PackedR2Object;
}

interface R2BucketGetRequest {
    readonly bucketName: string;
    readonly key: string;
    readonly options?: PackedR2GetOptions;
}

interface R2BucketGetResponse {
    readonly result?: { object: PackedR2Object, bodyId?: number };
}

interface R2BucketPutRequest {
    readonly bucketName: string;
    readonly key: string;
    readonly options?: PackedR2PutOptions;
    readonly bodyId: number | undefined;
    readonly bodyText: string | undefined;
    readonly bodyBytes: Uint8Array | undefined;
    readonly bodyNull: boolean;
}

interface R2BucketPutResponse {
    readonly object: PackedR2Object;
}

interface R2BucketCreateMultipartUploadRequest {
    readonly bucketName: string;
    readonly key: string;
    readonly options?: PackedR2MultipartOptions;
}

interface R2BucketResumeMultipartUploadRequest {
    readonly bucketName: string;
    readonly key: string;
    readonly uploadId: string;
}

interface R2BucketMultipartUploadResponse {
    readonly key: string;
    readonly uploadId: string;
}

interface R2MpuUploadPartRequest {
    readonly bucketName: string;
    readonly key: string;
    readonly uploadId: string;
    readonly partNumber: number;
    readonly bodyId: number | undefined;
    readonly bodyText: string | undefined;
    readonly bodyBytes: Uint8Array | undefined;
    readonly bodyNull: boolean;
}

interface R2MpuAbortRequest {
    readonly bucketName: string;
    readonly key: string;
    readonly uploadId: string;
}

interface R2MpuCompleteRequest {
    readonly bucketName: string;
    readonly key: string;
    readonly uploadId: string;
    readonly uploadedParts: R2UploadedPart[];
}

class RpcR2ObjectBody implements R2ObjectBody {
    readonly key: string;
    readonly version: string;
    readonly size: number;
    readonly etag: string;
    readonly httpEtag: string;
    readonly checksums: R2Checksums;
    readonly uploaded: Date;
    readonly httpMetadata: R2HTTPMetadata;
    readonly customMetadata: Record<string, string>;

    readonly body: ReadableStream;
    get bodyUsed(): boolean { throw new Error(`bodyUsed not supported`); }

    constructor(object: R2Object, stream: ReadableStream<Uint8Array>) {
        this.key = object.key;
        this.version = object.version;
        this.size = object.size;
        this.etag = object.etag;
        this.httpEtag = object.httpEtag;
        this.checksums = object.checksums;
        this.uploaded = object.uploaded;
        this.httpMetadata = object.httpMetadata;
        this.customMetadata = object.customMetadata;

        this.body = stream;
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
        return (await Bytes.ofStream(this.body)).array().buffer;
    }

    async text(): Promise<string> {
        return (await Bytes.ofStream(this.body)).utf8();
    }

    async json<T>(): Promise<T> {
        return JSON.parse(await this.text());
    }

    async blob(): Promise<Blob> {
        return new Blob([ await this.arrayBuffer() ]);
    }

    writeHttpMetadata(headers: Headers) { 
        const { contentType, contentLanguage, contentDisposition, contentEncoding, cacheControl, cacheExpiry } = this.httpMetadata;
        if (contentType !== undefined) headers.set('content-type', contentType);
        if (contentLanguage !== undefined) headers.set('content-language', contentLanguage);
        if (contentDisposition !== undefined) headers.set('content-disposition', contentDisposition);
        if (contentEncoding !== undefined) headers.set('content-encoding', contentEncoding);
        if (cacheControl !== undefined) headers.set('cache-control', cacheControl);
        if (cacheExpiry !== undefined) headers.set('expires', cacheExpiry.toString());
    }

}

class RpcR2MultipartUpload implements R2MultipartUpload {
    readonly bucketName: string;
    readonly bodies: Bodies;
    readonly channel: RpcChannel;
    readonly key: string;
    readonly uploadId: string;

    constructor(bucketName: string, bodies: Bodies, channel: RpcChannel, key: string, uploadId: string) {
        this.bucketName = bucketName;
        this.bodies = bodies;
        this.channel = channel;
        this.key = key;
        this.uploadId = uploadId;
    }

    async uploadPart(partNumber: number, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob): Promise<R2UploadedPart> {
        const { bucketName, bodies, channel, key, uploadId } = this;

        const { bodyId, bodyText, bodyBytes, bodyNull } = await packPutValue(value, bodies);

        const req: R2MpuUploadPartRequest = { bucketName, key, uploadId, partNumber, bodyId, bodyText, bodyBytes, bodyNull };
        return await channel.sendRequest('r2-mpu-upload-part', req, responseData => {
            const { partNumber, etag } = responseData as R2UploadedPart;
            return { partNumber, etag };
        });
    }

    async abort(): Promise<void> {
        const { bucketName, channel, key, uploadId } = this;

        const req: R2MpuAbortRequest = { bucketName, key, uploadId };
        await channel.sendRequest('r2-mpu-abort', req, () => {});
    }

    async complete(uploadedParts: R2UploadedPart[]): Promise<R2Object> {
        const { bucketName, channel, key, uploadId } = this;

        const req: R2MpuCompleteRequest = { bucketName, key, uploadId, uploadedParts };
        return await channel.sendRequest('r2-mpu-complete', req, responseData => {
            const { object: packedObject } = responseData as R2BucketPutResponse;
            return unpackR2Object(packedObject);
        });
    }
    
}
