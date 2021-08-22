import { serve } from './cli_serve.ts';
import { tail } from './cli_tail.ts';

import { parse } from 'https://deno.land/std@0.105.0/flags/mod.ts';

const args = parse(Deno.args);
// console.log(args);

if (args._.length > 0) {
    const command = args._[0];
    const fn = { serve, tail }[command];
        if (fn) {
            await fn(args._.slice(1), args);
            Deno.exit(0);
        }
}
console.error(`denoflare <command> <script-name>  # command: serve, tail`);
Deno.exit(1);
