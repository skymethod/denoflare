import { Bytes } from './bytes.ts';
import { R2Checksums, R2Conditional, R2GetOptions, R2HTTPMetadata, R2MultipartOptions, R2Object, R2Objects, R2PutOptions, R2Range } from './cloudflare_workers_types.d.ts';

// R2Objects

export interface PackedR2Objects {
    readonly objects: PackedR2Object[];
    readonly truncated: boolean;
    readonly cursor?: string;
    readonly delimitedPrefixes: string[];
}

export function packR2Objects(unpacked: R2Objects): PackedR2Objects {
    return {
        objects: unpacked.objects.map(packR2Object),
        truncated: unpacked.truncated,
        cursor: unpacked.cursor,
        delimitedPrefixes: unpacked.delimitedPrefixes,
    };
}

export function unpackR2Objects(packed: PackedR2Objects): R2Objects {
    return { 
        objects: packed.objects.map(unpackR2Object), 
        truncated: packed.truncated, 
        cursor: packed.cursor, 
        delimitedPrefixes: packed.delimitedPrefixes, 
    };
}

// R2Object

export interface PackedR2Object {
    readonly key: string;
    readonly version: string;
    readonly size: number;
    readonly etag: string;
    readonly httpEtag: string;
    readonly checksums: PackedR2Checksums;
    readonly uploaded: string; // instant
    readonly httpMetadata: PackedR2HTTPMetadata;
    readonly customMetadata: Record<string, string>;
}

export function packR2Object(unpacked: R2Object): PackedR2Object {
    return {
        key: unpacked.key,
        version: unpacked.version,
        size: unpacked.size,
        etag: unpacked.etag,
        httpEtag: unpacked.httpEtag,
        checksums: packR2Checksums(unpacked.checksums),
        uploaded: unpacked.uploaded.toISOString(),
        httpMetadata: packR2HTTPMetadata(unpacked.httpMetadata),
        customMetadata: unpacked.customMetadata,
    };
}

export function unpackR2Object(packed: PackedR2Object): R2Object {
    return { 
        key: packed.key,
        version: packed.version,
        size: packed.size,
        etag: packed.etag,
        httpEtag: packed.httpEtag,
        checksums: unpackR2Checksums(packed.checksums),
        uploaded: new Date(packed.uploaded),
        httpMetadata: unpackR2HTTPMetadata(packed.httpMetadata),
        customMetadata: packed.customMetadata,
        writeHttpMetadata: _headers => { throw new Error(`writeHttpMetadata not supported`); }
    };
}

// R2HTTPMetadata

export interface PackedR2HTTPMetadata {
    readonly contentType?: string;
    readonly contentLanguage?: string;
    readonly contentDisposition?: string;
    readonly contentEncoding?: string;
    readonly cacheControl?: string;
    readonly cacheExpiry?: string; // instant
}

export function packR2HTTPMetadata(unpacked: R2HTTPMetadata): PackedR2HTTPMetadata {
    return {
        contentType: unpacked.contentType,
        contentLanguage: unpacked.contentLanguage,
        contentDisposition: unpacked.contentDisposition,
        contentEncoding: unpacked.contentEncoding,
        cacheControl: unpacked.cacheControl,
        cacheExpiry: unpacked.cacheExpiry?.toISOString(),
    };
}

export function unpackR2HTTPMetadata(packed: PackedR2HTTPMetadata): R2HTTPMetadata {
    return { 
        contentType: packed.contentType,
        contentLanguage: packed.contentLanguage,
        contentDisposition: packed.contentDisposition,
        contentEncoding: packed.contentEncoding,
        cacheControl: packed.cacheControl,
        cacheExpiry: unpackOptionalDate(packed.cacheExpiry),
    };
}

// R2Checksums

export interface PackedR2Checksums {
    readonly md5?: string;
    readonly sha1?: string;
    readonly sha256?: string;
    readonly sha384?: string;
    readonly sha512?: string;
}


export function packR2Checksums(unpacked: R2Checksums): PackedR2Checksums {
    return {
        md5: packHash(unpacked.md5),
        sha1: packHash(unpacked.sha1),
        sha256: packHash(unpacked.sha256),
        sha384: packHash(unpacked.sha384),
        sha512: packHash(unpacked.sha512),
    };
}

export function unpackR2Checksums(packed: PackedR2Checksums): R2Checksums {
    return { 
        md5: unpackArrayBuffer(packed.md5),
        sha1: unpackArrayBuffer(packed.sha1),
        sha256: unpackArrayBuffer(packed.sha256),
        sha384: unpackArrayBuffer(packed.sha384),
        sha512: unpackArrayBuffer(packed.sha512),
    };
}

// R2GetOptions

export interface PackedR2GetOptions {
    readonly onlyIf?: PackedR2Conditional | PackedHeaders;
    readonly range?: R2Range;
}

export function packR2GetOptions(unpacked: R2GetOptions): PackedR2GetOptions {
    const { onlyIf, range } = unpacked;
    return {
        onlyIf: onlyIf === undefined ? undefined 
            : onlyIf instanceof Headers ? packHeaders(onlyIf) 
            : packR2Conditional(onlyIf),
        range,
    };
}

export function unpackR2GetOptions(packed: PackedR2GetOptions): R2GetOptions {
    return { 
        onlyIf: packed.onlyIf === undefined ? undefined
            : Array.isArray(packed.onlyIf) ? unpackHeaders(packed.onlyIf)
            : unpackR2Conditional(packed.onlyIf),
        range: packed.range,
     };
}

// R2Conditional

export interface PackedR2Conditional {
    readonly etagMatches?: string;
    readonly etagDoesNotMatch?: string;
    readonly uploadedBefore?: string; // instant
    readonly uploadedAfter?: string; // instant
}

export function unpackR2Conditional(packed: PackedR2Conditional): R2Conditional {
    return { 
        etagMatches: packed.etagMatches, 
        etagDoesNotMatch: packed.etagDoesNotMatch, 
        uploadedBefore: unpackOptionalDate(packed.uploadedBefore),
        uploadedAfter: unpackOptionalDate(packed.uploadedAfter),
    };
}

export function packR2Conditional(unpacked: R2Conditional): PackedR2Conditional {
    return { 
        etagMatches: unpacked.etagMatches, 
        etagDoesNotMatch: unpacked.etagDoesNotMatch, 
        uploadedBefore: unpacked.uploadedBefore?.toISOString(),
        uploadedAfter: unpacked.uploadedAfter?.toISOString(),
    };
}

// Headers

export type PackedHeaders = [string, string][];

export function unpackHeaders(packed: PackedHeaders): Headers {
    return new Headers(packed);
}

export function packHeaders(headers: Headers): PackedHeaders {
    return [...headers];
}

// R2PutOptions

export interface PackedR2PutOptions {
    readonly onlyIf?: PackedR2Conditional | PackedHeaders;
    readonly httpMetadata?: PackedR2HTTPMetadata | PackedHeaders;
    readonly customMetadata?: Record<string, string>;
    readonly md5?: string;
    readonly sha1?: string;
    readonly sha256?: string;
    readonly sha384?: string;
    readonly sha512?: string;
}

export function unpackR2PutOptions(packed: PackedR2PutOptions): R2PutOptions {
    return {
        onlyIf: packed.onlyIf === undefined ? undefined
            : Array.isArray(packed.onlyIf) ? unpackHeaders(packed.onlyIf)
            : unpackR2Conditional(packed.onlyIf),
        httpMetadata: packed.httpMetadata === undefined ? undefined
            : Array.isArray(packed.httpMetadata) ? unpackHeaders(packed.httpMetadata)
            : unpackR2HTTPMetadata(packed.httpMetadata),
        customMetadata: packed.customMetadata,
        md5: packed.md5,
        sha1: packed.sha1,
        sha256: packed.sha256,
        sha384: packed.sha384,
        sha512: packed.sha512,
    };
}

export function packR2PutOptions(unpacked: R2PutOptions): PackedR2PutOptions {
    return {
        onlyIf: unpacked.onlyIf === undefined ? undefined
            : unpacked.onlyIf instanceof Headers ? packHeaders(unpacked.onlyIf)
            : packR2Conditional(unpacked.onlyIf),
        httpMetadata: unpacked.httpMetadata === undefined ? undefined
            : unpacked.httpMetadata instanceof Headers ? packHeaders(unpacked.httpMetadata)
            : packR2HTTPMetadata(unpacked.httpMetadata),
        customMetadata: unpacked.customMetadata,
        md5: packHash(unpacked.md5),
        sha1: packHash(unpacked.sha1),
        sha256: packHash(unpacked.sha256),
        sha384: packHash(unpacked.sha384),
        sha512: packHash(unpacked.sha512),
    };
}

// R2MultipartOptions

export interface PackedR2MultipartOptions {
    readonly httpMetadata?: PackedR2HTTPMetadata | PackedHeaders;
    readonly customMetadata?: Record<string, string>;
}

export function unpackR2MultipartOptions(packed: PackedR2MultipartOptions): R2MultipartOptions {
    return {
        httpMetadata: packed.httpMetadata === undefined ? undefined
            : Array.isArray(packed.httpMetadata) ? unpackHeaders(packed.httpMetadata)
            : unpackR2HTTPMetadata(packed.httpMetadata),
        customMetadata: packed.customMetadata,
    };
}

export function packR2MultipartOptions(unpacked: R2MultipartOptions): PackedR2MultipartOptions {
    return {
        httpMetadata: unpacked.httpMetadata === undefined ? undefined
            : unpacked.httpMetadata instanceof Headers ? packHeaders(unpacked.httpMetadata)
            : packR2HTTPMetadata(unpacked.httpMetadata),
        customMetadata: unpacked.customMetadata,
    }
}

//

function unpackOptionalDate(packed: string | undefined): Date | undefined {
    return typeof packed === 'string' ? new Date(packed) : undefined;
}

function packHash(hash: string | ArrayBuffer | undefined): string | undefined {
    if (hash === undefined || typeof hash === 'string') return hash;
    return new Bytes(new Uint8Array(hash)).hex();
}

function unpackArrayBuffer(hex: string | undefined): ArrayBuffer | undefined {
    if (hex === undefined) return undefined;
    return Bytes.ofHex(hex).array().buffer as ArrayBuffer;
}
