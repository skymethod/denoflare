import { CLI_VERSION } from './cli_version.ts';
import { html, marked, ensureDir, join } from './deps_cli.ts';
import { directoryExists, fileExists } from './fs_util.ts';
import { ParseError, parseJsonc } from './jsonc.ts';
import { checkSiteConfig } from './site_config_validation.ts';
import { SiteConfig } from './site_generator.ts';

export async function generate(args: (string | number)[], options: Record<string, unknown>) {
    if (options.help || args.length < 2) {
        dumpHelp();
        return;
    }

    const verbose = !!options.verbose;

    const repoDir = args[0];
    if (typeof repoDir !== 'string') throw new Error(`Bad repoDir: ${repoDir}`);
    if (!await directoryExists(repoDir)) throw new Error(`Bad repoDir, does not exist: ${repoDir}`);

    const outputDir = args[1];
    if (typeof outputDir !== 'string') throw new Error(`Bad outputDir: ${outputDir}`);
    if (await fileExists(outputDir)) throw new Error(`Bad outputDir, exists as file: ${outputDir}`);

    const config = await loadSiteConfig(repoDir);

    const indexHtml = await computeIndexHtml(repoDir, config, { verbose, dumpEnv: !!options.dumpEnv });
    if (verbose) console.log(indexHtml);

    if (verbose) console.log(`Ensuring dir exists: ${outputDir}`);
    await ensureDir(outputDir);
    if (verbose) console.log(`Writing index.html`);
    const indexHtmlFilename = join(outputDir, 'index.html');
    await Deno.writeTextFile(indexHtmlFilename, indexHtml);
    if (verbose) console.log(`Done writing to ${outputDir}`);
}

//

async function loadSiteConfig(repoDir: string): Promise<SiteConfig> {
    for (const name of [ 'config.jsonc', 'config.json']) {
        const filename = join(repoDir, name);
        if (await fileExists(filename)) {
            const contents = await Deno.readTextFile(filename);
            const errors: ParseError[] = [];
            const siteConfig = parseJsonc(contents, errors, {  allowTrailingComma: true });
            return checkSiteConfig(siteConfig);
        }
    }
    throw new Error(`Site config (config.jsonc, config.json) not found in repoDir: ${repoDir}`);
}

async function computeIndexHtml(repoDir: string, config: SiteConfig, opts: { verbose: boolean, dumpEnv: boolean }): Promise<string> {
    const { title, description, origin, themeColor, themeColorDark } = config;
    let { twitterUsername } = config;
    if (twitterUsername !== undefined && !twitterUsername.startsWith('@')) twitterUsername = '@' + twitterUsername;
    const { verbose, dumpEnv} = opts;

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
${ twitterUsername ? html`<meta name="twitter:site" content="${twitterUsername}">` : '' }
<meta property="og:url" content="${origin}">
<link rel="canonical" href="${origin}">
${ themeColorDark ? html`<meta name="theme-color" content="${themeColorDark}" media="(prefers-color-scheme: dark)">` : '' }
${ themeColor ? html`<meta name="theme-color" content="${themeColor}">` : '' }
</head>
<body>
$MARKDOWN
${ dumpEnv ? html`<pre>${Object.entries(Deno.env.toObject()).sort((lhs, rhs) => lhs[0].localeCompare(rhs[0])).map(v => `${v[0]}: ${v[1]}`).join('\n')}</pre>` : '' }
</body>
</html>
`.toString();

    const { lexer, parser } = marked;

    const indexMdPath = join(repoDir, 'index.md');
    if (!await fileExists(indexMdPath)) throw new Error(`index.md not found in repoDir: ${repoDir}`);
    const indexMd = await Deno.readTextFile(indexMdPath);
    const indexMdResolved = indexMd.replaceAll(/\$([_A-Z0-9]+)/g, (_, g1) => Deno.env.get(g1) || '');
    const tokens = lexer(indexMdResolved);
    if (verbose) console.log(tokens);
    const markdownHtml = parser(tokens);

    return rt.replace('$MARKDOWN\n', markdownHtml);
}

//

function dumpHelp() {
    const lines = [
        `denoflare-site-generate ${CLI_VERSION}`,
        'Generate static output for Cloudfare Pages',
        '',
        'USAGE:',
        '    denoflare site generate [FLAGS] [OPTIONS] [repo-dir] [output-dir]',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'ARGS:',
        '    <repo-dir>      Local path to the git repo to use as the source input for generation',
        '    <output-dir>    Local path to the directory to use for generated output',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
