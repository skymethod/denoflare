import { R2Bucket } from './deps.ts';

export interface WorkerEnv {
    readonly bucket: R2Bucket;
    readonly flags?: string;
    readonly allowIps?: string;
    readonly denyIps?: string;
    readonly credentials?: string;
    readonly maxSkewMinutes?: string; // default: 15
    readonly maxExpiresMinutes?: string; // default: 7 days
}
