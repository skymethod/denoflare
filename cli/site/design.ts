import { encodeXml } from '../../common/xml_util.ts';
import { fromFileUrl, html, join, marked, hljs } from '../deps_cli.ts';
import { Page } from './page.ts';
import { computeBreadcrumbs, SidebarNode } from './sidebar.ts';
import { SiteConfig, SiteSearchConfig } from './site_config.ts';
import { replaceSuffix } from './site_model.ts';
import { computeToc, Heading, TocNode } from './toc.ts';

export async function computeHtml(opts: { page: Page, path: string, contentRepoPath: string, config: SiteConfig, sidebar: SidebarNode, contentUpdateTime: number, inputDir: string, 
        manifestPath: string | undefined, localOrigin: string | undefined, verbose?: boolean, dumpEnv?: boolean }): Promise<string> {
    const { page, path, contentRepoPath, config, sidebar, contentUpdateTime, verbose, inputDir, manifestPath, localOrigin } = opts;
    const { markdown } = page;
    const { siteMetadata, themeColor, themeColorDark, product, productRepo, contentRepo, productSvg, search } = config;
    const { twitterUsername, image, imageAlt, faviconIco, faviconSvg, faviconMaskSvg, faviconMaskColor } = siteMetadata;

    const title = `${page.titleResolved} · ${siteMetadata.title}`;
    
    const description = page.frontmatter.summary || siteMetadata.description;

    const origin = localOrigin || siteMetadata.origin || 'https://NO-ORIGIN';
    const url = origin + path;
    const imageUrl = typeof image === 'string' && image.startsWith('/') ? `${origin}${image}` : image;

    let outputHtml = html`<!DOCTYPE html>
<html lang="en" theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
${ imageUrl ? html`<meta property="og:image" content="${imageUrl}">` : '' }
${ imageUrl && imageAlt ? html`<meta property="og:image:alt" content="${imageAlt}">` : '' }
<meta property="og:locale" content="en_US">
<meta property="og:type" content="website">
${ imageUrl ? html`<meta name="twitter:card" content="summary_large_image">` : '' }
${ twitterUsername ? html`<meta name="twitter:site" content="${twitterUsername}">` : '' }
<meta property="og:url" content="${url}">
<link rel="canonical" href="${url}">
${ faviconIco ? html`<link rel="icon" href="${faviconIco}">` : '' }
${ faviconSvg ? html`<link rel="icon" href="${faviconSvg}" type="image/svg+xml">` : '' }
${ faviconMaskSvg && faviconMaskColor ? html`<link rel="mask-icon" href="${faviconMaskSvg}" color="${faviconMaskColor}">` : '' }
${ manifestPath ? html`<link rel="manifest" href="${manifestPath}">` : '' }
${ themeColorDark ? html`<meta name="theme-color" content="${themeColorDark}" media="(prefers-color-scheme: dark)">` : '' }
${ themeColor ? html`<meta name="theme-color" content="${themeColor}">` : '' }
`.toString();

    const designHtml = await computeDesignHtml();
    const startMarker = '<!-- start -->';
    outputHtml += designHtml.substring(designHtml.indexOf(startMarker) + startMarker.length);

    // hide the organization stuff for now
    outputHtml = outputHtml.replace('<div class="mobile-header">', '<div class="mobile-header" style="visibility:hidden;">');
    outputHtml = outputHtml.replace('<div class="sidebar-section sidebar-header-section">', '<div class="sidebar-section sidebar-header-section" style="visibility:hidden;">');

    // set product
    outputHtml = outputHtml.replaceAll(/<!-- start: product -->.*?<!-- end: product -->/sg, encodeXml(product));

    // set product link
    outputHtml = outputHtml.replaceAll(/ href="#product-link"/sg, ` href="/"`);

    // set product logo
    const productSvgContents = await readSvg(inputDir, productSvg);
    outputHtml = outputHtml.replaceAll(/<!-- start: product logo -->(.*?)<!-- end: product logo -->/sg, (_, g1) => {
        return computeProductLogoHtml(g1, productSvgContents);
    });

    // product github
    outputHtml = outputHtml.replace(/<!-- start: product github -->(.*?)<!-- end: product github -->/s, (_, g1) => {
        return computeProductGithubHtml(g1, productRepo);
    });

    // docsearch css
    outputHtml = outputHtml.replace(/<!-- start: docsearch css -->(.*?)<!-- end: docsearch css -->/s, (_, g1) => {
        return search ? g1 : '';
    });

    // docsearch script
    outputHtml = outputHtml.replace(/<!-- start: docsearch script -->(.*?)<!-- end: docsearch script -->/s, (_, g1) => {
        return search ? computeDocsearchScript(g1, search) : '';
    });

    // choose page type template
    const isDocument = (page.frontmatter.type || 'document') === 'document';
    if (isDocument) {
        outputHtml = outputHtml.replace(/<!-- start: page-type="overview" -->.*?<!-- end: page-type="overview" -->/s, '');
    } else {
        outputHtml = outputHtml.replace(/<!-- start: page-type="document" -->.*?<!-- end: page-type="document" -->/s, '');
        outputHtml = outputHtml.replace(` style="display:none;"`, '');
    }

    // render sidebar
    outputHtml = outputHtml.replace(/<!-- start: sidebar -->.*?<!-- end: sidebar -->/s, (substr) => {
        return computeSidebarHtml(substr, sidebar, path);
    });

    // render breadcrumbs
    outputHtml = outputHtml.replace(/<!-- start: breadcrumb -->(.*?)<!-- end: breadcrumb -->/s, (_, g1) => {
        return computeBreadcrumbsHtml(g1, sidebar, path);
    });

    // render markdown
    const markdownResolved = markdown

        // simple $ENV_VAR replacements
        .replaceAll(/\$([_A-Z0-9]+)/g, (_, g1) => Deno.env.get(g1) || '') 
        
        // primary buttons
        .replaceAll(/<Button\s+type="primary"\s+href="(.*?)"\s*>(.*?)<\/Button>/g, (_, g1, g2) => computePrimaryButtonHtml(g1, g2))

        // asides
        .replaceAll(/<Aside(\s+type="warning")?(\s+header="(.*?)")?>(.*?)<\/Aside>/gs, (_, g1, _g2, g3, g4) => computeAsideHtml(!!g1, g3, g4))
        ;
    const tokens = marked.lexer(markdownResolved);
    if (verbose) console.log(tokens);

    const headings: Heading[] = [];
    const renderer = new class extends marked.Renderer {
        link(href: string | null, title: string | null, text: string): string {
            if (typeof href === 'string' && /^https?:\/\//.test(href)) {
                return computeExternalAnchorHtml(href, text);
            }
            let a = `<a class="markdown-link"`;
            if (typeof href === 'string') a += ` href="${encodeXml(href)}"`;
            if (typeof title === 'string') a += ` title="${encodeXml(title)}"`;
            a += `><span class="markdown-link-content">${encodeXml(text)}</span></a>`;
            return a;
        }
        heading(text: string, level: 1 | 2 | 3 | 4 | 5 | 6, _raw: string, slugger: marked.Slugger): string {
            const textEscaped = encodeXml(text);
            if (level === 1) return `<h1>${textEscaped}</h1>`;

            const id = slugger.slug(text);
            headings.push({ level, text, id });
            const idEscaped = encodeXml(id);

            return '' +
`<h${level} id="${idEscaped}">
    <span class="markdown-header-anchor-positioner">
        <a class="markdown-header-anchor link link-without-underline" href="#${idEscaped}" aria-hidden="true">​</a>
    </span>
    <span>${textEscaped}</span>
</h${level}>`;
        }
        code(code: string, language: string | undefined, _isEscaped: boolean): string {
            if ((language || '').length === 0) {
                return `<pre class="code-block code-block-scrolls-horizontally"><code>${encodeXml(code)}</code></pre>`;
            }
            language = language === 'jsonc' ? 'json' : language; // highlight.js does not support jsonc
            const highlightedCodeHtml = hljs.highlight(code, { language }).value;
            return `<pre class="code-block code-block-scrolls-horizontally"><code>${highlightedCodeHtml}</code></pre>`;
        }
        codespan(code: string): string {
            return `<code class="inline-code">${code}</code>`;
        }
    }();
    const markdownHtml = marked.parser(tokens, { renderer });
    outputHtml = outputHtml.replace(/<!-- start: markdown -->.*?<!-- end: markdown -->/s, markdownHtml);

    // render toc
    if (isDocument) {
        const toc = computeToc(headings);
        outputHtml = outputHtml.replace(/<!-- start: toc -->.*?<!-- end: toc -->/s, (substr) => {
            return computeTocHtml(substr, toc);
        });
    }

    // content github
    outputHtml = outputHtml.replace(/<!-- start: content github -->(.*?)<!-- end: content github -->/s, (_, g1) => {
        return computeContentGithubHtml(g1, contentRepoPath, contentRepo);
    });

    // content time
    outputHtml = outputHtml.replace(/<!-- start: content time -->(.*?)<!-- end: content time -->/s, (_, g1) => {
        return computeContentUpdateTimeHtml(g1, contentUpdateTime);
    });

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

function computeBreadcrumbsHtml(designHtml: string, sidebar: SidebarNode, path: string): string {
    const breadcrumbs = computeBreadcrumbs(sidebar, path);
    return breadcrumbs.map(v => computeBreadcrumbHtml(v, designHtml)).join('\n');
}

function computeBreadcrumbHtml(node: SidebarNode, designHtml: string): string {
    return designHtml
    .replaceAll(/<!-- start: breadcrumb-text -->(.*?)<!-- end: breadcrumb-text -->/g, encodeXml(node.title))
    .replace(/ href=".*?"/, ` href="${encodeXml(node.path)}"`)
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
            appendSidebarNodeHtml(child, path, navItemTemplate, navItemWithChildrenTemplate, pieces, 1);
        }
        return pieces.join('');
    });

    return outputHtml;
}

function appendSidebarNodeHtml(node: SidebarNode, path: string, navItemTemplate: string, navItemWithChildrenTemplate: string, pieces: string[], depth: number) {
    if (node.children.length === 0) {
        pieces.push(computeSidebarItemHtml(node, path, navItemTemplate));
    } else {
        let rt = computeSidebarItemHtml(node, path, navItemWithChildrenTemplate, depth);
        rt = rt.replace(/<!-- start: children -->(.*?)<!-- end: children -->/s, () => {
            const subpieces: string[] = [];
            for (const child of node.children) {
                appendSidebarNodeHtml(child, path, navItemTemplate, navItemWithChildrenTemplate, subpieces, depth + 1);
            }
            return subpieces.join('');
        });
        pieces.push(rt);
    }
}

function computeSidebarItemHtml(node: SidebarNode, path: string, template: string, depth?: number): string {
    let rt = template
        .replaceAll(/<!-- start: sidebar-nav-item-text -->(.*?)<!-- end: sidebar-nav-item-text -->/g, encodeXml(node.title))
        .replace(/ href=".*?"/, ` href="${encodeXml(node.path)}"`)
        .replaceAll(`depth="1" style="--depth:1"`, `depth="${depth}" style="--depth:${depth}"`)
        ;
    const active = node.path === path || (node.path + '/') === path;
    if (!active) {
        rt = rt.replaceAll(' is-active=""', '');
    }
    return rt;
}

function computeTocHtml(designHtml: string, toc: TocNode[]): string {
    if (toc.length === 0) return '';
    let tocItemWithChildrenTemplate = '';
    let outputHtml = designHtml.replace(/<!-- start: toc-item-with-children -->(.*?)<!-- end: toc-item-with-children -->/s, (_, g1) => {
        tocItemWithChildrenTemplate = g1;
        return '';
    });

    outputHtml = outputHtml.replace(/<!-- start: toc-item -->(.*?)<!-- end: toc-item -->/s, (_, g1) => {
        const tocItemTemplate: string = g1;
        const pieces: string[] = [];
        for (const tocItem of toc) {
            appendTocNodeHtml(tocItem, tocItemTemplate, tocItemWithChildrenTemplate, pieces);
        }
        return pieces.join('');
    });

    return outputHtml;
}

function appendTocNodeHtml(node: TocNode, tocItemTemplate: string, tocItemWithChildrenTemplate: string, pieces: string[]) {
    const children = node.children || [];
    if (children.length === 0) {
        pieces.push(computeTocItemHtml(node, tocItemTemplate));
    } else {
        let rt = computeTocItemHtml(node, tocItemWithChildrenTemplate);
        rt = rt.replace(/<!-- start: toc-children -->(.*?)<!-- end: toc-children -->/s, () => {
            const subpieces: string[] = [];
            for (const child of children) {
                appendTocNodeHtml(child, tocItemTemplate, tocItemWithChildrenTemplate, subpieces);
            }
            return subpieces.join('');
        });
        pieces.push(rt);
    }
}

function computeTocItemHtml(node: TocNode, template: string): string {
    return template
        .replaceAll(/<!-- start: toc-item-text -->(.*?)<!-- end: toc-item-text -->/g, encodeXml(node.title))
        .replace(/ href=".*?"/, ` href="#${encodeXml(node.anchorId)}"`);
}

function computeProductGithubHtml(designHtml: string, productRepo: string | undefined): string {
    if (!productRepo) return '';
    return designHtml.replace(/ href=".*?"/, ` href="https://github.com/${encodeXml(productRepo)}"`);
}

function computeContentGithubHtml(designHtml: string, contentRepoPath: string, contentRepo: string | undefined): string {
    if (!contentRepo) return '';
    return designHtml.replace(/ href=".*?"/, ` href="https://github.com/${encodeXml(contentRepo)}/blob/HEAD${encodeXml(contentRepoPath)}"`);
}

function computeContentUpdateTimeHtml(_designHtml: string, contentUpdateTime: number): string {
    const instant = new Date(contentUpdateTime).toISOString();
    return html`<time datetime="${instant}" title="${instant}">${instant}</time>`.toString();
}

function computeExternalAnchorHtml(href: string, text: string): string {
    return html
`<a href="${href}" class="markdown-link">
    <span class="markdown-link-content">${text}</span><span class="markdown-link-external-icon" aria-hidden="true">
        <svg fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 16 16" role="img" aria-labelledby="title-for-external-link-icon" xmlns="http://www.w3.org/2000/svg"><title id="title-for-external-link-icon">External link icon</title><path d="M6.75,1.75h-5v12.5h12.5v-5m0,-4v-3.5h-3.5M8,8l5.5-5.5"></path></svg>
        <span is-visually-hidden="">Open external link</span>
    </span>
</a>`.toString();
}

function computeProductLogoHtml(designHtml: string, productSvgContents: string | undefined): string {
    return productSvgContents || designHtml;
}

async function readSvg(inputDir: string, svgPath: string | undefined): Promise<string | undefined> {
    if (!svgPath) return undefined;
    const path = join(inputDir, svgPath);
    const contents = await Deno.readTextFile(path);
    const i = contents.indexOf('<svg');
    return i < 0 ? contents : contents.substring(i);
}

function computePrimaryButtonHtml(href: string, text: string): string {
return html
`<p>
<a href="${href}" class="button button-is-primary">${text}</a>
</p>`.toString();
}

function computeDocsearchScript(designHtml: string, search: SiteSearchConfig): string {
    return designHtml
        .replace('${appId}', search.appId)
        .replace('${apiKey}', search.apiKey)
        .replace('${indexName}', search.indexName);
}

function computeAsideHtml(isWarning: boolean, header: string | undefined, contents: string): string {
    return `<aside class="markdown-aside" role="note" data-type="${isWarning ? 'warning' : 'note'}">${header ? `<div class="markdown-aside-header">${header}</div>` : ''}${contents}</aside>`;
}
