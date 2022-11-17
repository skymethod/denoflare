import { Bytes } from '../common/bytes.ts';
import { isStringRecord } from '../common/check.ts';

export interface CryptoKeyDef {
    readonly format: string;
    readonly algorithm: AesKeyGenParams | HmacKeyGenParams;
    readonly usages: KeyUsage[];
    readonly base64: string;
}

export function parseCryptoKeyDef(json: string): CryptoKeyDef {
    const obj = JSON.parse(json);
    const { format, algorithm, usages, base64 } = obj;
    if (typeof format !== 'string') throw new Error(`Bad format: ${JSON.stringify(format)} in ${JSON.stringify(obj)}`);
    if (!isStringRecord(algorithm)) throw new Error(`Bad algorithm: ${JSON.stringify(algorithm)} in ${JSON.stringify(obj)}`);
    const { name } = algorithm;
    if (typeof name !== 'string') throw new Error(`Bad algorithm.name: ${JSON.stringify(name)} in ${JSON.stringify(obj)}`);
    if (!Array.isArray(usages) || !usages.every(v => typeof v === 'string')) throw new Error(`Bad usages: ${JSON.stringify(usages)} in ${JSON.stringify(obj)}`);
    if (typeof base64 !== 'string') throw new Error(`Bad base64: ${JSON.stringify(base64)} in ${JSON.stringify(obj)}`);

    // deno-lint-ignore no-explicit-any
    return { format, algorithm: algorithm as any, usages, base64 };
}

export async function toCryptoKey(def: CryptoKeyDef): Promise<CryptoKey> {
    const { format, base64, algorithm, usages } = def;
    if (format !== 'pkcs8' && format !== 'raw' && format !== 'spki') throw new Error(`Format ${format} not supported`);
    const keyData: BufferSource = Bytes.ofBase64(base64).array();
    return await crypto.subtle.importKey(format, keyData, algorithm, true, usages);
}

export async function cryptoKeyProvider(json: string): Promise<CryptoKey> {
    const def = parseCryptoKeyDef(json);
    return await toCryptoKey(def);
}
