import { R2Bucket } from './deps.ts';

export interface WorkerEnv {
    readonly bucket: R2Bucket;
    readonly flags?: string;
    readonly allowIps?: string;
    readonly denyIps?: string;
    readonly directoryListingLimit?: string; // default: 1000 (max) to workaround r2 bug
    readonly allowCorsOrigins?: string; // e.g. * or https://origin1.com, https://origin2.com
    readonly allowCorsTypes?: string; // if allowed cors origin, further restricts by file extension (.mp4, .m3u8, .ts) or content-type (video/mp4, application/x-mpegurl, video/mp2t)
}
