import { Bytes } from '../common/bytes.ts';
import { Md5 } from './deps_cli.ts';

export async function computeMd5(input: Bytes | string | ReadableStream<Uint8Array>, format: 'hex' | 'base64' = 'hex'): Promise<string> {
    const md5 = new Md5();
    if (typeof input === 'string' || input instanceof Bytes) {
        const bytes = typeof input === 'string' ? Bytes.ofUtf8(input) : input;
        md5.update(bytes.array());
    } else {
        for await (const chunk of input) {
            // chunk.length = 65536
            md5.update(chunk);
        }  
    }
    return md5.toString(format);
}
