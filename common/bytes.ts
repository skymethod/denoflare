export class Bytes {
    public static EMPTY = new Bytes(new Uint8Array(0));
    
    private readonly _bytes: Uint8Array;

    public readonly length: number;

    constructor(bytes: Uint8Array) {
        this._bytes = bytes;
        this.length = bytes.length;
    }

    public array(): Uint8Array {
        return this._bytes;
    }

    public async sha1(): Promise<Bytes> {
        const hash = await cryptoSubtle().digest('SHA-1', this._bytes);
        return new Bytes(new Uint8Array(hash));
    }

    public async hmacSha1(key: Bytes): Promise<Bytes> {
        const cryptoKey = await cryptoSubtle().importKey('raw', key._bytes, { name: 'HMAC', hash: 'SHA-1' }, true, ['sign']);
        const sig = await cryptoSubtle().sign('HMAC', cryptoKey, this._bytes);
        return new Bytes(new Uint8Array(sig));
    }

    public async sha256(): Promise<Bytes> {
        const hash = await cryptoSubtle().digest('SHA-256', this._bytes);
        return new Bytes(new Uint8Array(hash));
    }

    public async hmacSha256(key: Bytes): Promise<Bytes> {
        const cryptoKey = await cryptoSubtle().importKey('raw', key._bytes, { name: 'HMAC', hash: 'SHA-256' }, true, ['sign']);
        const sig = await cryptoSubtle().sign('HMAC', cryptoKey, this._bytes);
        return new Bytes(new Uint8Array(sig));
    }
    
    public hex(): string {
        const a = Array.from(this._bytes);
        return a.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    public static ofHex(hex: string): Bytes {
        if (hex === '') {
            return Bytes.EMPTY;
        }
        return new Bytes(new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))));
    } 

    public utf8() {
        return new TextDecoder().decode(this._bytes);
    }

    public static ofUtf8(str: string): Bytes {
        return new Bytes(new TextEncoder().encode(str));
    }

    public base64(): string {
        return base64Encode(this._bytes);
    }

    public static ofBase64(base64: string): Bytes {
        return new Bytes(base64Decode(base64));
    }

    public static formatSize(sizeInBytes: number): string {
        const sign = sizeInBytes < 0 ? '-' : '';
        let size = Math.abs(sizeInBytes);
        if (size < 1024) return `${sign}${size}bytes`;
        size = size / 1024;
        if (size < 1024) return `${sign}${roundToOneDecimal(size)}kb`;
        size = size / 1024;
        return `${sign}${roundToOneDecimal(size)}mb`;
    }

}

//

function roundToOneDecimal(value: number): number {
    return Math.round(value * 10) / 10;
}

function base64Encode(buf: Uint8Array): string {
    let string = '';
    (buf).forEach(
        (byte) => { string += String.fromCharCode(byte) }
    )
    return btoa(string);
}

function base64Decode(str: string): Uint8Array {
    str = atob(str);
    const
        length = str.length,
        buf = new ArrayBuffer(length),
        bufView = new Uint8Array(buf);
    for (let i = 0; i < length; i++) { bufView[i] = str.charCodeAt(i) }
    return bufView;
}

function cryptoSubtle(): SubtleCrypto {
    return crypto.subtle as unknown as SubtleCrypto;
}
