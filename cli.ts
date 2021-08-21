import { serve } from './cli_serve.ts';
import { tail } from './cli_tail.ts';

if (Deno.args.length >= 2) {
    const command = Deno.args[0];
    const scriptName = Deno.args[1];
    const fn = { serve, tail }[command];
    if (fn) {
        await fn(scriptName);
        Deno.exit(0);
    }
}
console.error(`denoflare <command> <script-name>  # command: serve, tail`);
Deno.exit(1);
