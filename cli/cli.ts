import { serve, SERVE_COMMAND } from './cli_serve.ts';
import { tail } from './cli_tail.ts';
import { push } from './cli_push.ts';
import { site } from './cli_site.ts';
import { parseFlags } from './deps_cli.ts';
import { CLI_VERSION } from './cli_version.ts';
import { analytics } from './cli_analytics.ts';
import { cfapi, CFAPI_COMMAND } from './cli_cfapi.ts';
import { r2, R2_COMMAND } from './cli_r2.ts';
import { auth } from './cli_auth.ts';
import { CliCommand } from './cli_command.ts';
import { denoflareCliCommand } from './cli_common.ts';

const args = parseFlags(Deno.args);

const VERSION_COMMAND = denoflareCliCommand('version', 'Dump cli version');

const DENOFLARE = CliCommand.of(['denoflare'], undefined, { version: CLI_VERSION })
    .subcommand(SERVE_COMMAND, serve)
    .subcommand(CFAPI_COMMAND, cfapi)
    .subcommand(R2_COMMAND, r2)
    .subcommand(VERSION_COMMAND, version)
    ;

if (args.cmd) {
    await DENOFLARE.routeSubcommand(args._, args);
} else {
    if (args._.length > 0) {
        const command = args._[0];
        const fn = { serve, push, tail, site, analytics, version, cfapi, r2, auth }[command];
            if (fn) {
                await fn(args._.slice(1), args);
                Deno.exit(0);
            }
    }

    dumpHelp();

    Deno.exit(1);
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
        '    analytics   Dump stats via the Cloudflare GraphQL Analytics API',
        '    cfapi       Call the Cloudflare REST API',
        '    r2          Interact with R2 using the S3 compatible API',
        '    version     Dump cli version',
        '',
        'For command-specific help: denoflare [command] --help',
    ];
    for (const line of lines) {
        console.log(line);
    }
}

function version() {
    console.log(CLI_VERSION)
}
