import { importBinary } from './deps_worker.ts';

// https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/summary-card-with-large-image

// Images for this Card support an aspect ratio of 2:1 with minimum dimensions of 300x157 or maximum of 4096x4096 pixels. 
// Images must be less than 5MB in size. JPG, PNG, WEBP and GIF formats are supported. 
// Only the first frame of an animated GIF will be used. SVG is not supported.
export const TWITTER_IMAGE_PNG = await importBinary(import.meta.url, './twitter_image.png');
export const TWITTER_IMAGE_VERSION = '2';
