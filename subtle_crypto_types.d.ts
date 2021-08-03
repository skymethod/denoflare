// https://github.com/denoland/deno/issues/1891
export interface SubtleCrypto {
    digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
    importKey(format: string, keyData: Uint8Array, algorithm: HmacImportParams, extractable: boolean, keyUsages: string[]): Promise<CryptoKey>;
    sign(algorithm: string, key: CryptoKey, data: Uint8Array): Promise<ArrayBuffer>;
}

// deno-lint-ignore no-empty-interface
export interface CryptoKey {

}

export interface Algorithm {
    name: string;
}

export interface HmacImportParams extends Algorithm {
    hash: string;
}
