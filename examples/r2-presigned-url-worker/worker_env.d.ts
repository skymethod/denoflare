import { R2Bucket } from './deps.ts';

export interface WorkerEnv {
    readonly bucket: R2Bucket;
    readonly pushId?: string;
    readonly flags?: string;
    readonly allowIps?: string;
    readonly denyIps?: string;
    readonly credentials?: string;
    readonly maxSkewMinutes?: string;
    readonly maxExpiresMinutes?: string;
    
}
