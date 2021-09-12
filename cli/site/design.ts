import { fromFileUrl, html, marked } from '../deps_cli.ts';
import { Page } from './page.ts';
import { SidebarNode } from './sidebar.ts';
import { SiteConfig } from './site_config.ts';
import { replaceSuffix } from './site_model.ts';

export async function computeHtml(opts: { page: Page, path: string, config: SiteConfig, sidebar: SidebarNode, verbose?: boolean, dumpEnv?: boolean }): Promise<string> {
    const { page, path, config, sidebar, verbose, dumpEnv } = opts;
    const { markdown } = page;
    const { siteMetadata, themeColor, themeColorDark } = config;
    const { twitterUsername } = siteMetadata;

    const title = `${page.titleResolved} · ${siteMetadata.title}`;
    
    const description = page.frontmatter.summary || siteMetadata.description;

    const origin = siteMetadata.origin || 'http://example.com';
    const url = origin + path;

    let outputHtml = html`<!DOCTYPE html>
<html lang="en" theme="dark">
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
`.toString();

    const designHtml = await computeDesignHtml();
    const startMarker = '<!-- start -->';
    outputHtml += designHtml.substring(designHtml.indexOf(startMarker) + startMarker.length);

    const isDocument = (page.frontmatter.type || 'document') === 'document';
    console.log(`${page.titleResolved} isDocument=${isDocument}`);
    if (isDocument) {
        outputHtml = outputHtml.replace(/<!-- start: page-type="overview" -->.*?<!-- end: page-type="overview" -->/s, '');
    } else {
        outputHtml = outputHtml.replace(/<!-- start: page-type="document" -->.*?<!-- end: page-type="document" -->/s, '');
        outputHtml = outputHtml.replace(` style="display:none;"`, '');
    }

    outputHtml = outputHtml.replace(/<!-- start: sidebar -->.*?<!-- end: sidebar -->/s, (substr, args) => {
        return computeSidebarHtml(substr, sidebar, path);
    });

    const { lexer, parser } = marked;

    const markdownResolved = markdown.replaceAll(/\$([_A-Z0-9]+)/g, (_, g1) => Deno.env.get(g1) || ''); // TODO more replacements
    const tokens = lexer(markdownResolved);
    if (verbose) console.log(tokens);
    const markdownHtml = parser(tokens);

    outputHtml = outputHtml.replace(/<!-- start: markdown -->.*?<!-- end: markdown -->/s, markdownHtml);

    return outputHtml;
}

//

let _designHtml: string | undefined;

async function computeDesignHtml(): Promise<string> {
    if (!_designHtml) {
        const readOrFetchDesignHtml = async function() {
            const designHtmlUrl = replaceSuffix(import.meta.url, '.ts', '.html', { required: false });
            if (designHtmlUrl.startsWith('file://')) {
                const path = fromFileUrl(designHtmlUrl);
                return await Deno.readTextFile(path);
            }
            return await (await fetch(designHtmlUrl)).text();
        }
        _designHtml = await readOrFetchDesignHtml();
    }
    return _designHtml!;
}

function computeSidebarHtml(designHtml: string, sidebar: SidebarNode, path: string): string {
    let navItemWithChildrenTemplate = '';
    let outputHtml = designHtml.replace(/<!-- start: sidebar-nav-item-with-children -->(.*?)<!-- end: sidebar-nav-item-with-children -->/s, (_, g1) => {
        navItemWithChildrenTemplate = g1;
        return '';
    });

    outputHtml = outputHtml.replace(/<!-- start: sidebar-nav-item -->(.*?)<!-- end: sidebar-nav-item -->/s, (_, g1) => {
        const navItemTemplate: string = g1;
        const pieces: string[] = [];
        pieces.push(computeSidebarItemHtml(sidebar, path, navItemTemplate));
        for (const child of sidebar.children) {
            appendSidebarNodeHtml(child, path, navItemTemplate, navItemWithChildrenTemplate, pieces);
        }
        return pieces.join('');
    });

    return outputHtml;
}

function appendSidebarNodeHtml(node: SidebarNode, path: string, navItemTemplate: string, navItemWithChildrenTemplate: string, pieces: string[]) {
    if (node.children.length === 0) {
        pieces.push(computeSidebarItemHtml(node, path, navItemTemplate));
    } else {
        let rt = computeSidebarItemHtml(node, path, navItemWithChildrenTemplate);
        rt = rt.replace(/<!-- start: children -->(.*?)<!-- end: children -->/s, () => {
            const subpieces: string[] = [];
            for (const child of node.children) {
                appendSidebarNodeHtml(child, path, navItemTemplate, navItemWithChildrenTemplate, subpieces);
            }
            return subpieces.join('');
        });
        pieces.push(rt);
    }
}

function computeSidebarItemHtml(node: SidebarNode, path: string, template: string): string {
    let rt = template
        .replaceAll(/<!-- start: sidebar-nav-item-text -->(.*?)<!-- end: sidebar-nav-item-text -->/g, node.title)
        .replace(/ href=".*?"/, ` href="${node.path}"`);
    const active = node.path === path;
    if (!active) {
        rt = rt.replaceAll(' is-active=""', '');
    }
    return rt;
}
