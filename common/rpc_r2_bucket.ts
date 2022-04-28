import { R2Bucket, R2GetOptions, R2HeadOptions, R2HTTPMetadata, R2ListOptions, R2Object, R2ObjectBody, R2Objects, R2PutOptions } from './cloudflare_workers_types.d.ts';
import { RpcChannel } from './rpc_channel.ts';
import { Bodies, BodyResolver } from './rpc_fetch.ts';
import { Bytes } from './bytes.ts';
import { PackedR2GetOptions, PackedR2HeadOptions, PackedR2Object, PackedR2Objects, PackedR2PutOptions, packR2GetOptions, packR2HeadOptions, packR2Object, packR2Objects, packR2PutOptions, unpackR2GetOptions, unpackR2HeadOptions, unpackR2Object, unpackR2Objects, unpackR2PutOptions } from './rpc_r2_model.ts';

export function addRequestHandlerForRpcR2Bucket(channel: RpcChannel, bodies: Bodies, bodyResolver: BodyResolver, r2BucketResolver: (bucketName: string) => R2Bucket) {
    channel.addRequestHandler('r2-bucket-list', async requestData => {
        const { bucketName, options } = requestData as R2BucketListRequest;
        const target = r2BucketResolver(bucketName);

        const objects = packR2Objects(await target.list(options));

        const res: R2BucketListResponse = { objects };
        return res;
    });
    channel.addRequestHandler('r2-bucket-delete', async requestData => {
        const { bucketName, key } = requestData as R2BucketDeleteRequest;
        const target = r2BucketResolver(bucketName);

        await target.delete(key);
        return {};
    });
    channel.addRequestHandler('r2-bucket-head', async requestData => {
        const { bucketName, key, options: packedOptions } = requestData as R2BucketHeadRequest;
        const target = r2BucketResolver(bucketName);

        const options = packedOptions === undefined ? undefined : unpackR2HeadOptions(packedOptions);
        const object = await target.head(key, options);
        const packedObject = object ? packR2Object(object) : undefined;

        const res: R2BucketHeadResponse = { object: packedObject };
        return res;
    });
    channel.addRequestHandler('r2-bucket-get', async requestData => {
        const { bucketName, key, options: packedOptions } = requestData as R2BucketGetRequest;
        const target = r2BucketResolver(bucketName);

        const options = packedOptions === undefined ? undefined : unpackR2GetOptions(packedOptions);
        const object = await target.get(key, options);

        let result: { object: PackedR2Object, bodyId: number } | undefined;
        if (object) {
            result = {
                object: packR2Object(object),
                bodyId: bodies.computeBodyId(object.body)!,
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

    async head(key: string, options?: R2HeadOptions): Promise<R2Object | null> {
        const { bucketName } = this;
        const req: R2BucketHeadRequest = { bucketName, key, options: options === undefined ? undefined : packR2HeadOptions(options) };
        return await this.channel.sendRequest('r2-bucket-head', req, responseData => {
            const { object: packedObject } = responseData as R2BucketHeadResponse;
            return packedObject === undefined ? null : unpackR2Object(packedObject);
        });
    }

    async get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null> {
        const { bucketName } = this;
        const req: R2BucketGetRequest = { bucketName, key, options: options === undefined ? undefined : packR2GetOptions(options) };
        return await this.channel.sendRequest('r2-bucket-get', req, responseData => {
            const { result } = responseData as R2BucketGetResponse;
            if (result === undefined) return null;
            const { object, bodyId } = result;
            const stream = this.bodyResolver(bodyId);
            return new RpcR2ObjectBody(unpackR2Object(object), stream);
        });
    }
    
    async put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null, options?: R2PutOptions): Promise<R2Object> {
        const { bucketName } = this;

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
        } else if (value instanceof ReadableStream) {
            bodyId = this.bodies.computeBodyId(value);
        } else {
            bodyBytes = new Uint8Array(value.buffer);
        }

        const req: R2BucketPutRequest = { bucketName, key, options: options === undefined ? undefined : packR2PutOptions(options), bodyId, bodyText, bodyBytes, bodyNull };
        return await this.channel.sendRequest('r2-bucket-put', req, responseData => {
            const { object: packedObject } = responseData as R2BucketPutResponse;
            return unpackR2Object(packedObject);
        });
    }

    async delete(key: string): Promise<void> {
        const { bucketName } = this;
        const req: R2BucketDeleteRequest = { bucketName, key };
        await this.channel.sendRequest('r2-bucket-delete', req, () => { });
    }

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
    readonly key: string;
}

interface R2BucketHeadRequest {
    readonly bucketName: string;
    readonly key: string;
    readonly options?: PackedR2HeadOptions;
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
    readonly result?: { object: PackedR2Object, bodyId: number };
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

class RpcR2ObjectBody implements R2ObjectBody {
    readonly key: string;
    readonly version: string;
    readonly size: number;
    readonly etag: string;
    readonly httpEtag: string;
    readonly uploaded: Date;
    readonly httpMetadata: R2HTTPMetadata;
    readonly customMetadata: Record<string, string>;

    writeHttpMetadata(_headers: Headers) { throw new Error(`writeHttpMetadata not supported`); }

    readonly body: ReadableStream;
    get bodyUsed(): boolean { throw new Error(`bodyUsed not supported`); }

    constructor(object: R2Object, stream: ReadableStream<Uint8Array>) {
        this.key = object.key;
        this.version = object.version;
        this.size = object.size;
        this.etag = object.etag;
        this.httpEtag = object.httpEtag;
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

}
