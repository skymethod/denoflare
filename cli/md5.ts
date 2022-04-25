import { Bytes } from '../common/bytes.ts';
import { Md5 } from './deps_cli.ts';

export function computeMd5(bytes: Bytes, format: 'hex' | 'base64' = 'hex') {
    return new Md5().update(bytes.array()).toString(format);
}
