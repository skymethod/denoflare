import { CryptoKey, HmacImportParams, SubtleCrypto } from './subtle_crypto_types.d.ts';
import { HmacSha256 } from 'https://deno.land/std@0.103.0/hash/sha256.ts';
import { Sha1 } from 'https://deno.land/std@0.103.0/hash/sha1.ts';

// https://deno.land/std@0.103.0/hash

export class SubtleCryptoPolyfill implements SubtleCrypto {

    static applyIfNecessary() {
        // deno-lint-ignore no-explicit-any
        const cryptoSubtle = crypto.subtle as any || undefined;
        const useNative = cryptoSubtle
            && typeof cryptoSubtle.digest === 'function'
            && typeof cryptoSubtle.importKey === 'function'
            && typeof cryptoSubtle.sign === 'function'
            ;
        if (useNative) return;

        const cryptoSubtlePolyfill = new SubtleCryptoPolyfill();
        if (cryptoSubtle) {
            // can't use any of the native ones until they all exist (importKey still missing in 1.12)
            cryptoSubtle.digest = cryptoSubtlePolyfill.digest;
            cryptoSubtle.importKey = cryptoSubtlePolyfill.importKey;
            cryptoSubtle.sign = cryptoSubtlePolyfill.sign;
        } else {
            // deno-lint-ignore no-explicit-any
            (crypto as any).subtle = cryptoSubtlePolyfill;
        }
    }

    digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> {
        if (algorithm === 'SHA-1') {
            return Promise.resolve(new Sha1().update(data).arrayBuffer());
        }
        throw new Error(`digest not implemented: algorithm=${algorithm} data.length=${data.length}`);
    }

    importKey(format: string, keyData: Uint8Array, algorithm: HmacImportParams, extractable: boolean, keyUsages: string[]): Promise<CryptoKey> {
        if (format === 'raw' && algorithm.name === 'HMAC' && algorithm.hash === 'SHA-256' && keyUsages.length === 1 && keyUsages[0] === 'sign') {
            const key = new CryptoKeyPolyfill(algorithm.name, algorithm.hash, keyData);
            return Promise.resolve(key);
        }
        throw new Error(`importKey not implemented: format=${format} keyData.length=${keyData.length} algorithm.name=${algorithm.name} algorithm.hash=${algorithm.hash} extractable=${extractable} keyUsages=${keyUsages}`);
    }

    sign(algorithm: string, key: CryptoKey, data: Uint8Array): Promise<ArrayBuffer> {
        if (algorithm === 'HMAC' && CryptoKeyPolyfill.is(key) && key.name === 'HMAC' && key.hash === 'SHA-256') {
            const hmac = new HmacSha256(key.keyData).update(data);
            return Promise.resolve(hmac.arrayBuffer());
        }
        throw new Error(`sign not implemented: algorithm=${algorithm} key=${key} data.length=${data.length}`);
    }

}

//

class CryptoKeyPolyfill implements CryptoKey {
    readonly kind = 'CryptoKeyPolyfill';
    readonly name: string;
    readonly hash?: string;
    readonly keyData: Uint8Array;

    constructor(name: string, hash: string | undefined, keyData: Uint8Array) {
        this.name = name;
        this.hash = hash;
        this.keyData = keyData;
    }

    static is(key: CryptoKey): key is CryptoKeyPolyfill {
        // deno-lint-ignore no-explicit-any
        return (key as any).kind === 'CryptoKeyPolyfill';
    }

    toString() {
        return `{name=${this.name}, keyData.length=${this.keyData.length}${ this.hash ? `, hash=${this.hash}` : ''}}`;
    }

}
