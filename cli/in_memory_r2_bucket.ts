import { Bytes } from '../common/bytes.ts';
import { R2Bucket, R2Checksums, R2GetOptions, R2HTTPMetadata, R2ListOptions, R2Object, R2ObjectBody, R2Objects, R2PutOptions, R2Range } from '../common/cloudflare_workers_types.d.ts';

export class InMemoryR2Bucket implements R2Bucket {
    private readonly records: Record<string, ObjectRecord> = {}; // by key
    private readonly sortedKeys: string[] = [];

    constructor(name: string) {
        console.log(`new InMemoryR2Bucket(${name})`);
    }

    head(key: string): Promise<R2Object | null> {
        throw new Error(`InMemoryR2Bucket: head(${JSON.stringify({ key })}) not implemented`);
    }

    get(key: string): Promise<R2ObjectBody | null>;
    get(key: string, options: R2GetOptions): Promise<R2ObjectBody | R2Object | null>;
    async get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | R2Object | null> {
        const { ...rest } = options ?? {};
        if (Object.keys(rest).length > 0) throw new Error(`InMemoryR2Bucket: get(${JSON.stringify({ key, options })}) not implemented`);

        await Promise.resolve();

        const { records } = this;
        const record = records[key];
        if (!record) return null;

        return new InMemoryR2ObjectBody(record.info, record.bytes);
    }

    async put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object> {
        const { ...rest } = options ?? {};
        if (Object.keys(rest).length > 0) throw new Error(`InMemoryR2Bucket: put(${JSON.stringify({ key, value: value === null ? 'null' : typeof value === 'object' ? value.constructor.name : typeof value, options })}) not implemented`);

        const bytes = value instanceof ArrayBuffer ? new Uint8Array(value)
            : value instanceof ReadableStream ? (await Bytes.ofStream(value)).array()
            : value === null ? new Uint8Array()
            : value instanceof Blob ? new Uint8Array(await value.arrayBuffer())
            : typeof value === 'string' ? Bytes.ofUtf8(value).array()
            : new Uint8Array(value.buffer);

        const etag = (await new Bytes(bytes).sha1()).hex();
        const { records, sortedKeys } = this;
        if (!sortedKeys.includes(key)) {
            sortedKeys.push(key);
            sortedKeys.sort();
        }
        const info: R2ObjectInfo = {
            key,
            version: crypto.randomUUID(),
            size: bytes.byteLength,
            etag,
            uploaded: new Date(),
        };
        records[key] = { info, bytes };
        return new InMemoryR2Object(info);
    }

    delete(keys: string | string[]): Promise<void> {
        throw new Error(`InMemoryR2Bucket: delete(${JSON.stringify({ keys })}) not implemented`);
    }

    async list(options?: R2ListOptions): Promise<R2Objects> {
        await Promise.resolve();
        const { prefix, ...rest } = options ?? {};

        if (Object.keys(rest).length > 0)  throw new Error(`InMemoryR2Bucket: list(${JSON.stringify({ options })}) not implemented`);

        const { records, sortedKeys } = this;
        const objects: R2Object[] = [];
        const truncated = false;
        let cursor: string | undefined;
        const delimitedPrefixes: string[] = [];
        for (const key of sortedKeys) {
            if (typeof prefix === 'string' && !key.startsWith(prefix)) continue;
            const { info } = records[key];
            objects.push(new InMemoryR2Object(info));
        }
        return { objects, truncated, cursor, delimitedPrefixes };
    }

}

//

type ObjectRecord = { info: R2ObjectInfo, bytes: Uint8Array };

type R2ObjectInfo = { key: string, version: string, size: number, etag: string, uploaded: Date }

class InMemoryR2Object implements R2Object {
    readonly key: string;
    readonly version: string;
    readonly size: number;
    readonly etag: string;
    readonly httpEtag: string;
    readonly checksums: R2Checksums = {}; // TODO
    readonly uploaded: Date;
    readonly httpMetadata: R2HTTPMetadata = {}; // TODO
    readonly customMetadata: Record<string, string> = {}; // TODO
    readonly range?: R2Range; // TODO

    constructor({ key, version, size, etag, uploaded }: R2ObjectInfo) {
        this.key = key;
        this.version = version;
        this.size = size;
        this.etag = etag;
        this.httpEtag = `"${etag}"`;
        this.uploaded = uploaded;
    }

    writeHttpMetadata(headers: Headers): void {
        throw new Error(`InMemoryR2Object: writeHttpMetadata(${JSON.stringify({ headers })}) not implemented`);
    }
    
}

class InMemoryR2ObjectBody extends InMemoryR2Object implements R2ObjectBody {
   
    private readonly bytes: Uint8Array;

    private bodyUsed_ = false;

    constructor(info: R2ObjectInfo, bytes: Uint8Array) {
        super(info);
        this.bytes = bytes;
    }

    get body(): ReadableStream { 
        this.bodyUsed_ = true;
        return new Blob([ this.bytes ]).stream();
    }

    get bodyUsed(): boolean { 
        return this.bodyUsed_;
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
        await Promise.resolve();
        this.bodyUsed_ = true;
        return this.bytes.buffer;
    }

    async text(): Promise<string> {
        await Promise.resolve();
        this.bodyUsed_ = true;
        return new Bytes(this.bytes).utf8();
    }

    async json<T>(): Promise<T> {
        return JSON.parse(await this.text());
    }

    blob(): Promise<Blob> {
        throw new Error(`InMemoryR2ObjectBody: blob not implemented`);
    }
}
