import { Bytes } from '../common/bytes.ts';
import { versionCompare } from './versions.ts';

const { crypto: WasmCrypto } = await import(versionCompare(Deno.version.deno, '2.0.0') >= 0 ? 'jsr:@std/crypto@1.0.3': 'https://deno.land/std@0.224.0/crypto/mod.ts');

export async function computeStreamingSha256(stream: ReadableStream<Uint8Array>): Promise<Bytes> {
    const arr = await WasmCrypto.subtle.digest('SHA-256', stream);
    return new Bytes(new Uint8Array(arr));
}

export async function computeStreamingMd5(stream: ReadableStream<Uint8Array>): Promise<Bytes> {
    const arr = await WasmCrypto.subtle.digest('MD5', stream);
    return new Bytes(new Uint8Array(arr));
}

export async function computeMd5(input: Bytes | string): Promise<Bytes> {
    const bytes = typeof input === 'string' ? Bytes.ofUtf8(input) : input;
    const arr = await WasmCrypto.subtle.digest('MD5', bytes.array());
    return new Bytes(new Uint8Array(arr));
}
