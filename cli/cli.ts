import { serve } from './cli_serve.ts';
import { tail } from './cli_tail.ts';
import { push } from './cli_push.ts';
import { site } from './cli_site.ts';
import { parseFlags } from './deps_cli.ts';
import { CLI_VERSION } from './cli_version.ts';

const args = parseFlags(Deno.args);

if (args._.length > 0) {
    const command = args._[0];
    const fn = { serve, push, tail, site, version }[command];
        if (fn) {
            await fn(args._.slice(1), args);
            Deno.exit(0);
        }
}

function version() {
    console.log(CLI_VERSION);
}

function dumpHelp() {
    const lines = [
        `denoflare ${CLI_VERSION}`,
        '',
        'USAGE:',
        '    denoflare [command] [FLAGS] [OPTIONS] [args]',
        '',
        'COMMANDS:',
        '    serve       Run a worker script on a local web server',
        '    push        Upload a worker script to Cloudflare Workers',
        '    tail        View a stream of logs from a published worker',
        '    site        Develop and deploy a static docs site to Cloudflare Pages',
        '    version     Dump cli version',
        '',
        'For command-specific help: denoflare [command] --help',
    ];
    for (const line of lines) {
        console.log(line);
    }
}

dumpHelp();

Deno.exit(1);
