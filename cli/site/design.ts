import { html, marked } from '../deps_cli.ts';
import { Page } from './page.ts';
import { SidebarNode } from './sidebar.ts';
import { SiteConfig } from './site_config.ts';

export function computeHtml(opts: { page: Page, path: string, config: SiteConfig, sidebar: SidebarNode, verbose?: boolean, dumpEnv?: boolean }): string {
    const { page, path, config, sidebar, verbose, dumpEnv } = opts;
    const { markdown } = page;
    const { siteMetadata, themeColor, themeColorDark } = config;
    const { twitterUsername } = siteMetadata;

    const title = `${page.titleResolved} · ${siteMetadata.title}`;
    
    const description = page.frontmatter.summary || siteMetadata.description;

    const origin = siteMetadata.origin || 'http://example.com';
    const url = origin + path;

    // TODO real design
    const rt = html`<!DOCTYPE html>
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
<meta property="og:url" content="${url}">
<link rel="canonical" href="${url}">
${ themeColorDark ? html`<meta name="theme-color" content="${themeColorDark}" media="(prefers-color-scheme: dark)">` : '' }
${ themeColor ? html`<meta name="theme-color" content="${themeColor}">` : '' }
</head>
<body>
$MARKDOWN
${ dumpEnv ? html`<pre>${Object.entries(Deno.env.toObject()).sort((lhs, rhs) => lhs[0].localeCompare(rhs[0])).map(v => `${v[0]}: ${v[1]}`).join('\n')}</pre>` : '' }
<pre>${JSON.stringify(sidebar, undefined, 2)}</pre>
</body>
</html>
`.toString();

    const { lexer, parser } = marked;

    const markdownResolved = markdown.replaceAll(/\$([_A-Z0-9]+)/g, (_, g1) => Deno.env.get(g1) || ''); // TODO more replacements
    const tokens = lexer(markdownResolved);
    if (verbose) console.log(tokens);
    const markdownHtml = parser(tokens);

    return rt.replace('$MARKDOWN\n', markdownHtml);
}
