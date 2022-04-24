import { CLI_VERSION } from './cli_version.ts';
import { listObjects } from './cli_r2_list_objects.ts';

export async function r2(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    const subcommand = args[0];
    if (options.help && args.length === 0 || typeof subcommand !== 'string') {
        dumpHelp();
        return;
    }

    const fn = { 'list-objects': listObjects }[subcommand];
    if (fn) {
        await fn(args.slice(1), options);
    } else {
        dumpHelp();
    }
}

//

function dumpHelp() {
    const lines = [
        `denoflare-r2 ${CLI_VERSION}`,
        'Manage R2 storage using the S3 compatibility API',
        '',
        'USAGE:',
        '    denoflare r2 [subcommand] [FLAGS] [OPTIONS] [args]',
        '',
        'SUBCOMMANDS:',
        '    list-objects    List objects within a bucket',
        '',
        'For subcommand-specific help: denoflare site [subcommand] --help',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
