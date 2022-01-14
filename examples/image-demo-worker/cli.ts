import { parseFlags } from './deps_cli.ts';
import { computeTransforms } from './cli_transform_generator.ts';

const args = parseFlags(Deno.args);

if (args._.length > 0) {
    await imageDemo(args._, args);
    Deno.exit(0);
}

dumpHelp();

Deno.exit(1);

//

async function imageDemo(args: (string | number)[], options: Record<string, unknown>) {
    const command = args[0];
    const fn = { dumpTransforms, unsplash }[command];
    if (options.help || !fn) {
        dumpHelp();
        return;
    }
    await fn(args.slice(1), options);
}

async function dumpTransforms(_args: (string | number)[])  {
    const transforms = await computeTransforms();
    console.log(JSON.stringify(transforms, undefined, 2));
}

async function unsplash(args: (string | number)[], options: Record<string, unknown>) {
    const photoId = args[0];
    if (typeof photoId !== 'string') throw new Error(`Must provide photo id arg`);

    const accessKeyId = options['access-key-id'];
    if (typeof accessKeyId !== 'string') throw new Error(`Must provide --access-key-id`);
    const res = await fetch(`https://api.unsplash.com/photos/${photoId}`, { headers: { authorization: `Client-ID ${accessKeyId}`} });
    if (res.status !== 200 || res.headers.get('content-type') !== 'application/json') {
        console.log(res);
        console.log(await res.text());
        return;
    }
    const obj = await res.json();
    console.log(JSON.stringify(obj, undefined, 2));
}

function dumpHelp() {
    const lines = [
        `image-demo-cli`,
        'Tools for developing image-demo',
        '',
        'USAGE:',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'ARGS:',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
