import { R2Bucket, R2GetOptions, R2HeadOptions, R2ListOptions, R2Object, R2ObjectBody, R2Objects, R2PutOptions } from './cloudflare_workers_types.d.ts';
import { RpcChannel } from './rpc_channel.ts';
import { PackedR2HeadOptions, PackedR2Object, PackedR2Objects, packR2HeadOptions, packR2Object, packR2Objects, unpackR2HeadOptions, unpackR2Object, unpackR2Objects } from './rpc_r2_model.ts';

export function addRequestHandlerForRpcR2Bucket(channel: RpcChannel, r2BucketResolver: (bucketName: string) => R2Bucket) {
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
}

export class RpcR2Bucket implements R2Bucket {

    readonly bucketName: string;
    readonly channel: RpcChannel;

    constructor(bucketName: string, channel: RpcChannel) {
        this.bucketName = bucketName;
        this.channel = channel;
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

    get(_key: string, _options?: R2GetOptions): Promise<R2ObjectBody | null> {
        throw new Error(`RpcR2Bucket.get not implemented`);
    }
    
    put(_key: string, _value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null, _options?: R2PutOptions): Promise<R2Object> {
        throw new Error(`RpcR2Bucket.put not implemented`);
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
