import { computeHeadersString, R2, s3Fetch } from '../common/r2/r2.ts';
import { loadR2Options } from './cli_r2.ts';

export async function generic(args: (string | number)[], options: Record<string, unknown>) {
    const verbose = !!options.verbose;
    if (verbose) {
        R2.DEBUG = true;
    }

    const [ pathname ] = args;
    if (typeof pathname !== 'string' || !pathname.startsWith('/')) throw new Error(`Bad pathname: ${pathname}`);
    const { origin, region, context } = await loadR2Options(options);

    const url = new URL(`${origin}${pathname}`);

    const method = 'GET';
    const res = await s3Fetch({ method, url, region, context });

    console.log(`${res.status} ${computeHeadersString(res.headers)}`);
    console.log(await res.text());
}
