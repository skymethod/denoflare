import { Bytes } from './bytes.ts';

export interface Jwt {
    readonly header: Record<string, unknown>;
    readonly claims: Record<string, unknown>;
    readonly signature: Uint8Array;
}

export function decodeJwt(token: string): Jwt {
    const m = /^(\w+)\.(\w+)\.(\w+)$/.exec(token);
    if (!m) throw new Error(`Bad jwt token string`);
    const header = JSON.parse(Bytes.ofBase64(m[1], { urlSafe: true }).utf8());
    const claims = JSON.parse(Bytes.ofBase64(m[2], { urlSafe: true }).utf8());
    const signature = Bytes.ofBase64(m[3], { urlSafe: true }).array();
    return { header, claims, signature };
}
