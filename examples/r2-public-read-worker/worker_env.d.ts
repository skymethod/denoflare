import { R2Bucket } from './deps.ts';

export interface WorkerEnv {
    readonly bucket: R2Bucket;
    readonly flags?: string;
    readonly allowIps?: string;
    readonly denyIps?: string;
    readonly directoryListingLimit?: string; // default: 1000 (max) to workaround r2 bug
}
