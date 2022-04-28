import { R2Bucket, R2GetOptions, R2HeadOptions, R2ListOptions, R2Object, R2ObjectBody, R2Objects, R2PutOptions } from './cloudflare_workers_types.d.ts';
import { RpcChannel } from './rpc_channel.ts';

export function addRequestHandlerForRpcR2Bucket(channel: RpcChannel, r2BucketResolver: (bucketName: string) => R2Bucket) {
    channel.addRequestHandler('r2-bucket-list', async requestData => {
        const req = requestData as R2BucketListRequest;
        const target = r2BucketResolver(req.bucketName);

        const options = {}; // TODO unpack options
        const _objects = await target.list(options);

        const res: R2BucketListResponse = {
            objects: {} // TODO pack objects
        }
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

    async list(_options?: R2ListOptions): Promise<R2Objects> {
        const { bucketName } = this;
        const req: R2BucketListRequest = { bucketName, options: {} }; // TODO pack options
        return await this.channel.sendRequest('r2-bucket-list', req, responseData => {
            const _res = responseData as R2BucketListResponse;
            const rt = {} as R2Objects; // TODO unpack objects
            return rt;
        });
    }

    head(_key: string, _options?: R2HeadOptions): Promise<R2Object | null> {
        throw new Error(`RpcR2Bucket.head not implemented`);
    }

    get(_key: string, _options?: R2GetOptions): Promise<R2ObjectBody | null> {
        throw new Error(`RpcR2Bucket.get not implemented`);
    }
    
    put(_key: string, _value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null, _options?: R2PutOptions): Promise<R2Object> {
        throw new Error(`RpcR2Bucket.put not implemented`);
    }

    delete(_key: string): Promise<void> {
        throw new Error(`RpcR2Bucket.delete not implemented`);
    }

}

//

interface R2BucketListRequest {
    readonly bucketName: string;
    readonly options: Record<string, string>;
}

interface R2BucketListResponse {
    readonly objects?: Record<string, unknown>;
}
