import { Bytes } from './bytes.ts';
import { R2Conditional, R2GetOptions, R2HeadOptions, R2HTTPMetadata, R2Object, R2Objects, R2PutOptions, R2Range } from './cloudflare_workers_types.d.ts';

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

// R2HeadOptions

export interface PackedR2HeadOptions {
    readonly onlyIf?: PackedR2Conditional | PackedHeaders;
}

export function packR2HeadOptions(unpacked: R2HeadOptions): PackedR2HeadOptions {
    const { onlyIf } = unpacked;
    return {
        onlyIf: onlyIf === undefined ? undefined 
            : onlyIf instanceof Headers ? packHeaders(onlyIf) 
            : packR2Conditional(onlyIf)
    };
}

export function unpackR2HeadOptions(packed: PackedR2HeadOptions): R2HeadOptions {
    const { onlyIf } = packed;
    return {
        onlyIf: onlyIf === undefined ? undefined
            : Array.isArray(onlyIf) ? unpackHeaders(onlyIf)
            : unpackR2Conditional(onlyIf)
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
    readonly httpMetadata?: PackedR2HTTPMetadata | PackedHeaders;
    readonly customMetadata?: Record<string, string>;
    readonly md5?: string;
    readonly sha1?: string;
}

export function unpackR2PutOptions(packed: PackedR2PutOptions): R2PutOptions {
    return { 
        httpMetadata: packed.httpMetadata === undefined ? undefined
            : Array.isArray(packed.httpMetadata) ? unpackHeaders(packed.httpMetadata)
            : unpackR2HTTPMetadata(packed.httpMetadata),
        customMetadata: packed.customMetadata,
        md5: packed.md5,
        sha1: packed.sha1,
    };
}

export function packR2PutOptions(unpacked: R2PutOptions): PackedR2PutOptions {
    return { 
        httpMetadata: unpacked.httpMetadata === undefined ? undefined
            : unpacked.httpMetadata instanceof Headers ? packHeaders(unpacked.httpMetadata)
            : packR2HTTPMetadata(unpacked.httpMetadata),
        customMetadata: unpacked.customMetadata,
        md5: packHash(unpacked.md5),
        sha1: packHash(unpacked.sha1),
    };
}

//

function unpackOptionalDate(packed: string | undefined): Date | undefined {
    return typeof packed === 'string' ? new Date(packed) : undefined;
}

function packHash(hash: string | ArrayBuffer | undefined): string | undefined {
    if (hash === undefined || typeof hash === 'string') return hash;
    return new Bytes(new Uint8Array(hash)).hex();
}
