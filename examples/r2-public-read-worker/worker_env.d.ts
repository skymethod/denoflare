import { R2Bucket } from './deps.ts';

export interface WorkerEnv {
    readonly bucket: R2Bucket;
    readonly pushId?: string;
}
