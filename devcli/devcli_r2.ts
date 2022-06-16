//

import { ApiR2Bucket } from '../cli/api_r2_bucket.ts';
import { CLI_USER_AGENT } from '../cli/cli_common.ts';
import { loadConfig, resolveProfile } from '../cli/config_loader.ts';
import { R2 } from '../common/r2/r2.ts';

export async function tmp(args: (string | number)[], options: Record<string, unknown>) {
    const [ bucketName, key ] = args;
    if (typeof bucketName !== 'string') throw new Error();
    if (typeof key !== 'string') throw new Error();

    const verbose = !!options.verbose;
    if (verbose) {
        R2.DEBUG = true;
    }
    
    const config = await loadConfig(options);
    const profile = await resolveProfile(config, options);
    const bucket = await ApiR2Bucket.ofProfile(profile, bucketName, CLI_USER_AGENT);
    const { body } = await fetch('https://yahoo.com');
    const res = await bucket.put(key, body);
    console.log(res);
    // if (res) console.log(await res.text());
}
