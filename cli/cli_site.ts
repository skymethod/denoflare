import { CLI_VERSION } from './cli_version.ts';
import { html, marked, ensureDir, join } from './deps_cli.ts';

export async function site(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    const subcommand = args[0];
    if (options.help || typeof subcommand !== 'string' || subcommand !== 'generate') {
        dumpHelp();
        return;
    }
    const verbose = !!options.verbose;

    const indexHtml = computeIndexHtml({ title: 'My Title', description: 'My description, ensure <b>markup</b> is escaped.', origin: 'https://asdf.dev', verbose });
    if (verbose) console.log(indexHtml);

    if (typeof options.output === 'string') {
        if (verbose) console.log(`Ensuring dir exists: ${options.output}`);
        await ensureDir(options.output);
        if (verbose) console.log(`Writing index.html`);
        const indexHtmlFilename = join(options.output, 'index.html');
        await Deno.writeTextFile(indexHtmlFilename, indexHtml);
        if (verbose) console.log(`Done writing to ${options.output}`);
    }
}

//

function computeIndexHtml(opts: { title: string, description: string, origin: string, verbose: boolean }): string {
    const { title, description, origin, verbose } = opts;

    const rt =  html`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:locale" content="en_US">
<meta property="og:type" content="website">
<meta property="og:url" content="${origin}">
<link rel="canonical" href="${origin}">
</head>
<body>
$MARKDOWN
<pre>
${Object.entries(Deno.env.toObject()).sort((lhs, rhs) => lhs[0].localeCompare(rhs[0])).map(v => `${v[0]}: ${v[1]}`).join('\n')}
</pre>
</body>
</html>
`.toString();

    const { lexer, parser } = marked;

    const tmpMarkdown = `# Hello world\nThis is the index\n`;
    const tokens = lexer(tmpMarkdown);
    if (verbose) console.log(tokens);
    const markdownHtml = parser(tokens);

    return rt.replace('$MARKDOWN\n', markdownHtml);
}

//

function dumpHelp() {
    const lines = [
        `denoflare-site ${CLI_VERSION}`,
        'Develop and deploy a Cloudflare Pages static site',
        '',
        'USAGE:',
        '    denoflare site [subcommand] [FLAGS] [OPTIONS] [args]',
        '',
        'SUBCOMMANDS:',
        '    generate    Generate static output for Cloudfare Pages',
        '',
        'For subcommand-specific help: denoflare site [subcommand] --help',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
