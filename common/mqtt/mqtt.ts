export class Mqtt {
    static DEBUG = false;
}

export function encodeVariableByteInteger(value: number): number[] {
    const rt = [];
    do {
        let encodedByte = value % 128;
        value = Math.floor(value / 128);
        if (value > 0) {
            encodedByte = encodedByte | 128;
        }
        rt.push(encodedByte);
    } while (value > 0);
    return rt;
}

export function decodeVariableByteInteger(buffer: Uint8Array, startIndex: number): { value: number, bytesUsed: number } {
    let i = startIndex;
    let encodedByte = 0;
    let value = 0;
    let multiplier = 1;
    do {
        encodedByte = buffer[i++];
        value += (encodedByte & 127) * multiplier;
        if (multiplier > 128 * 128 * 128) throw Error('malformed length');
        multiplier *= 128;
    } while ((encodedByte & 128) != 0);
    return { value, bytesUsed: i - startIndex };
}

export function encodeUtf8(value: string): number[] {
    const arr = encoder.encode(value);
    // https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html#_UTF-8_Encoded_String
    if (arr.length > 65535) throw new Error('the maximum size of a UTF-8 Encoded String is 65,535 bytes.');
    const lengthBytes = [ arr.length >> 8, arr.length & 0xff ]; // always exactly 2 bytes
    return [ ...lengthBytes, ...arr ];
}

export function decodeUtf8(buffer: Uint8Array, startIndex: number): { text: string, bytesUsed: number } {
    const length = (buffer[startIndex] << 8) + buffer[startIndex + 1];
    const bytes = buffer.slice(startIndex + 2, startIndex + 2 + length);
    const text = decoder.decode(bytes);

    return { text, bytesUsed: length + 2 };
}

//

const encoder = new TextEncoder();

const decoder = new TextDecoder();
