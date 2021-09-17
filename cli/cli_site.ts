import { CLI_VERSION } from './cli_version.ts';
import { generate } from './cli_site_generate.ts';
import { serve } from './cli_site_serve.ts';

export async function site(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    const subcommand = args[0];
    if (options.help && args.length === 0 || typeof subcommand !== 'string') {
        dumpHelp();
        return;
    }

    const fn = { generate, serve }[subcommand];
    if (fn) {
        await fn(args.slice(1), options);
    } else {
        dumpHelp();
    }
}

//

function dumpHelp() {
    const lines = [
        `denoflare-site ${CLI_VERSION}`,
        'Develop and deploy a static docs site to Cloudflare Pages',
        '',
        'USAGE:',
        '    denoflare site [subcommand] [FLAGS] [OPTIONS] [args]',
        '',
        'SUBCOMMANDS:',
        '    generate    Generate static output for Cloudfare Pages',
        '    serve       Host static Cloudflare Pages site locally',
        '',
        'For subcommand-specific help: denoflare site [subcommand] --help',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
