import { Bytes, parseFlags } from './deps_cli.ts';

const { args, options } = parseFlags(Deno.args);

if (args.length > 0) {
    await webtail(args, options);
    Deno.exit(0);
}

dumpHelp();

Deno.exit(1);

//

async function webtail(args: (string | number)[], options: Record<string, unknown>) {
    const command = args[0];
    const fn = { b64 }[command];
    if (options.help || !fn) {
        dumpHelp();
        return;
    }
    await fn(args.slice(1));
}

async function b64(args: (string | number)[]) {
    const path = args[0];
    if (typeof path !== 'string') throw new Error('Must provide path to file');
    const contents = await Deno.readFile(path);
    const b64 = new Bytes(contents).base64();
    console.log(b64);
}


function dumpHelp() {
    const lines = [
        `webtail-cli`,
        'Tools for developing webtail',
        '',
        'USAGE:',
        '    deno run --unstable --allow-net examples/webtail-worker/cli.ts [FLAGS] [OPTIONS] [--] build',
        '    deno run --unstable --allow-net --allow-read examples/webtail-worker/cli.ts [FLAGS] [OPTIONS] [--] b64 <path>',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'ARGS:',
        '    b64 <path>    Dump out the b64 of a given file',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
