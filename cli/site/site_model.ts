import { relative, resolve, extname, emptyDir, isAbsolute, dirname, ensureDir, join } from '../deps_cli.ts';
import { directoryExists } from '../fs_util.ts';
import { ParseError, parseJsonc } from '../jsonc.ts';
import { computeHtml } from './design.ts';
import { Page, readPageFromFile } from './page.ts';
import { computeSidebar, SidebarInputItem } from './sidebar.ts';
import { SiteConfig } from './site_config.ts'
import { checkSiteConfig } from './site_config_validation.ts';
import { Bytes } from '../../common/bytes.ts';

export class SiteModel {

    private readonly inputDir: string;
    private readonly resources = new Map<string, ResourceInfo>(); // key = "resource path", e.g. /index.html for /index.md
    private readonly localOrigin?: string;

    private currentManifestPath: string | undefined;

    constructor(inputDir: string, opts: { localOrigin?: string } = {}) {
        const { localOrigin } = opts;
        this.localOrigin = localOrigin;
        if (!directoryExists(inputDir)) throw new Error(`Bad inputDir: ${inputDir}, must exist`);
        if (!isAbsolute(inputDir)) throw new Error(`Bad inputDir: ${inputDir}, must be absolute`);
        this.inputDir = inputDir;
    }

    async setInputFiles(files: InputFileInfo[]) {
        const contentUpdateTime = Date.now();

        // ensure resources exist
        for (const file of files) {
            const inputPath = file.path;
            if (!isAbsolute(inputPath)) throw new Error(`Bad inputPath: ${inputPath}, must be absolute`);
            const path = computeResourcePath(inputPath, this.inputDir);
            let resource = this.resources.get(path);
            if (!resource) {
                const extension = extname(inputPath);
                const includeInOutput = shouldIncludeInOutput(path, extension);
                const canonicalPath = computeCanonicalResourcePath(path);
                const contentRepoPath = computeContentRepoPath(inputPath, this.inputDir);
                resource = { inputPath, extension, includeInOutput, canonicalPath, contentRepoPath };
                this.resources.set(path, resource);
            }
        }

        // console.log([...this.resources.keys()].sort().map(v => `${v} ${this.resources.get(v)!.canonicalPath}`).join('\n'));

        // read config
        const config = await computeConfig(this.resources);

        // generate app manifest
        const { manifestPath, manifestContents } = await computeManifest(config);
        if (this.currentManifestPath !== manifestPath) {
            this.resources.set(manifestPath, {
                inputPath: join(this.inputDir, manifestPath),
                extension: '.webmanifest',
                includeInOutput: true,
                canonicalPath: manifestPath,
                contentRepoPath: '<generated>',
                outputText: manifestContents,
            });
            if (this.currentManifestPath) {
                this.resources.delete(this.currentManifestPath);
            }
            this.currentManifestPath = manifestPath;
        }

        // generate robots.txt
        const robotsTxtPath = '/robots.txt';
        const sitemapXmlPath = '/sitemap.xml';
        this.resources.set(robotsTxtPath, {
            inputPath: join(this.inputDir, robotsTxtPath),
            extension: '.txt',
            includeInOutput: true,
            canonicalPath: robotsTxtPath,
            contentRepoPath: '<generated>',
            outputText: `User-agent: *\nDisallow:\nSitemap: ${this.localOrigin || config.siteMetadata.origin || ''}${sitemapXmlPath}\n`,
        });

        // generate sitemap.xml
        const sitemapXmlContents = await computeSitemapXml(this.resources, config, this.localOrigin);
        this.resources.set(sitemapXmlPath, {
            inputPath: join(this.inputDir, sitemapXmlPath),
            extension: '.xml',
            includeInOutput: true,
            canonicalPath: sitemapXmlPath,
            contentRepoPath: '<generated>',
            outputText: sitemapXmlContents,
        });

        // read frontmatter from all md
        for (const [_, resource] of this.resources.entries()) {
            if (resource.extension === '.md') {
                resource.page = await readPageFromFile(resource.inputPath);
            }
        }

        // construct sidebar
        const sidebarInputItems: SidebarInputItem[] = [...this.resources.values()]
            .filter(v => v.extension === '.md' && v.includeInOutput)
            .map(v => ({ 
                title: v.page!.titleResolved, 
                path: v.canonicalPath === '/' ? v.canonicalPath : replaceSuffix(v.canonicalPath, '/', ''),
                hidden: v.page!.frontmatter.hidden,
                hideChildren: v.page!.frontmatter.hideChildren,
                order: v.page!.frontmatter.order,
            }));
        const sidebar = computeSidebar(sidebarInputItems);

        // transform markdown into html
        for (const [_, resource] of this.resources.entries()) {
            if (resource.extension === '.md') {
                const { canonicalPath: path, contentRepoPath } = resource;
                const { inputDir } = this;
                const page = resource.page!;
                const { localOrigin } = this;
                const outputHtml = await computeHtml({ inputDir, page, path, contentRepoPath, config, sidebar, contentUpdateTime, manifestPath, localOrigin, verbose: false, dumpEnv: false });
                resource.outputText = outputHtml;
            }
        }
    }

    async writeOutput(outputDir: string) {
        await checkConfigForOutput(this.resources);
        if (!isAbsolute(outputDir)) throw new Error(`Bad outputDir: ${outputDir}, must be absolute`);
        console.log(`writeOutput ${outputDir}`);
        await emptyDir(outputDir);
        const ensuredDirs = new Set();
        for (const [_, resource] of this.resources.entries()) {
            if (!resource.includeInOutput) continue;
            const outputPath = computeOutputPath(resource.inputPath, this.inputDir, outputDir);
            console.log(`Writing ${outputPath}`);
            const outputPathDirectory = dirname(outputPath);
            if (!ensuredDirs.has(outputPathDirectory)) {
                console.log('ensureDir ' + outputPathDirectory);
                await ensureDir(outputPathDirectory);
                ensuredDirs.add(outputPathDirectory);
            }
            if (resource.outputText !== undefined) {
                await Deno.writeTextFile(outputPath, resource.outputText);
            } else {
                await Deno.copyFile(resource.inputPath, outputPath);
            } 
        }
    }

    async handle(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const { pathname } = url;
        const resource = findResource(pathname, this.resources);
        if (resource) {
            if (pathname.endsWith('.html')) {
                url.pathname = replaceSuffix(pathname, '.html', '');
                const headers: HeadersInit = { 'Location': url.toString() };
                return new Response('', { status: 308, headers });
            } else if (pathname.endsWith('/index')) {
                url.pathname = replaceSuffix(pathname, '/index', '');
                const headers: HeadersInit = { 'Location': url.toString() };
                return new Response('', { status: 308, headers });
            }
        } else {
            const notFoundResource = findResource('/404', this.resources);
            if (notFoundResource) return await computeReponseForResource(notFoundResource, 404);
            return new Response('not found', { status: 404 });
        }
        return await computeReponseForResource(resource, 200);
    }

}

export interface InputFileInfo {
    readonly path: string;
    readonly version: string;
}

//

export function replaceSuffix(path: string, fromSuffix: string, toSuffix: string, opts: { required?: boolean } = { }): string {
    const { required } = opts;
    const endsWith = path.endsWith(fromSuffix);
    if (!endsWith && !!required) throw new Error(`Bad path: ${path}, expected to end in suffix: ${fromSuffix}`);
    return endsWith ? (path.substring(0, path.length - fromSuffix.length) + toSuffix) : path;
}

//

interface ResourceInfo {
    readonly inputPath: string; // full fs path to source file
    readonly extension: string; // with dot, e.g. .md
    readonly includeInOutput: boolean;
    readonly canonicalPath: string; // e.g. / for /index.html, and /foo for /foo.html
    readonly contentRepoPath: string; // e.g. /index.md
    page?: Page;
    outputText?: string;
}

//

const EXTENSIONS_TO_INCLUDE_IN_OUTPUT = new Map([
    // content-type from Cloudflare Pages
    ['.html', 'text/html; charset=utf-8'],
    ['.ico', 'image/x-icon'],
    ['.jpg', 'image/jpeg'],
    ['.json', 'application/json'],
    ['.md', 'text/html; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.txt', 'text/plain'],
    ['.webmanifest', 'application/manifest+json'],
    ['.xml', 'text/xml'],
]);

function computeContentType(resource: ResourceInfo): string {
    const contentType = EXTENSIONS_TO_INCLUDE_IN_OUTPUT.get(resource.extension);
    if (contentType) return contentType;
    throw new Error(`Unable to compute content-type for ${resource.canonicalPath}, extension=${resource.extension}`);
}

function shouldIncludeInOutput(path: string, extension: string): boolean {
    if (path === '/config.json' || path === '/config.jsonc' || path.toLowerCase() === '/readme.html') return false;
    return path === '/_redirects' || path === '/_headers' || EXTENSIONS_TO_INCLUDE_IN_OUTPUT.has(extension);
}

function computeOutputPath(inputFile: string, inputDir: string, outputDir: string) {
    const relativePath = relative(inputDir, inputFile);
    const outputPath = resolve(outputDir, relativePath);
    return replaceSuffix(outputPath, '.md', '.html');
}

function computeResourcePath(inputFile: string, inputDir: string): string {
    if (!inputFile.startsWith(inputDir)) throw new Error(`Bad inputFile: ${inputFile}, must reside under ${inputDir}`);
    const relativePath = relative(inputDir, inputFile);
    if (relativePath.startsWith('/')) throw new Error(`Unexpected relative path: ${relativePath}, inputFile=${inputFile}, inputDir=${inputDir}`);
    return '/' + replaceSuffix(relativePath, '.md', '.html');
}

function computeContentRepoPath(inputFile: string, inputDir: string): string {
    if (!inputFile.startsWith(inputDir)) throw new Error(`Bad inputFile: ${inputFile}, must reside under ${inputDir}`);
    const relativePath = relative(inputDir, inputFile);
    if (relativePath.startsWith('/')) throw new Error(`Unexpected relative path: ${relativePath}, inputFile=${inputFile}, inputDir=${inputDir}`);
    return '/' + relativePath;
}

function computeCanonicalResourcePath(resourcePath: string): string {
    if (resourcePath.endsWith('.html')) resourcePath = resourcePath.substring(0, resourcePath.length - '.html'.length);
    if (resourcePath.endsWith('/index')) resourcePath = resourcePath.substring(0, resourcePath.length - 'index'.length);
    return resourcePath;
}

async function computeConfig(resources: Map<string, ResourceInfo>): Promise<SiteConfig> {
    for (const path of ['/config.jsonc', '/config.json']) {
        const resource = resources.get(path);
        if (resource) {
            const contents = await Deno.readTextFile(resource.inputPath);
            const errors: ParseError[] = [];
            const config = parseJsonc(contents, errors, { allowTrailingComma: true });
            return checkSiteConfig(config);
        }
    }
    throw new Error(`Site config not found: /config.jsonc or /config.json`);
}

async function checkConfigForOutput(resources: Map<string, ResourceInfo>) {
    const config = await computeConfig(resources);
    if (!config.siteMetadata.origin) throw new Error(`Missing config.siteMetadata.origin, required when writing output`);
}

async function computeManifest(config: SiteConfig): Promise<{ manifestPath: string; manifestContents: string; }> {
    const icons = config.siteMetadata.faviconSvg ? [{ src: config.siteMetadata.faviconSvg, type: 'image/svg+xml' }] : [];
    const manifest: Record<string, unknown> = {
        'short_name': config.siteMetadata.title,
        name: config.siteMetadata.title,
        description: config.siteMetadata.description,
        icons: icons,
        'theme_color': config.themeColorDark || config.themeColor,
        'background_color': '#1d1f20',
        display: 'standalone',
        'start_url': '/',
        lang: 'en-US',
        dir: 'ltr',
    };
    if (config.siteMetadata.manifest) {
        for (const [name, value] of Object.entries(config.siteMetadata.manifest)) {
            manifest[name] = value;
        }
    }
    const manifestContents = JSON.stringify(manifest, undefined, 2);
    const manifestPath = `/app.${(await Bytes.ofUtf8(manifestContents).sha1()).hex()}.webmanifest`;
    return { manifestPath, manifestContents };
}

function findResource(pathname: string, resources: Map<string, ResourceInfo>): ResourceInfo | undefined {
    const rt = resources.get(pathname);
    if (rt) return rt;
    const canonical = computeCanonicalResourcePath(pathname);
    return [...resources.values()].find(v => v.canonicalPath === canonical || v.canonicalPath === (canonical + '/'));
}

async function computeReponseForResource(resource: ResourceInfo, status: number ): Promise<Response> {
    const headers: HeadersInit = { 'Content-Type': computeContentType(resource) }
    if (resource.outputText) {
        return new Response(resource.outputText, { headers });
    }
    const body: BodyInit = resource.outputText ? resource.outputText : await Deno.readFile(resource.inputPath);
    return new Response(body, { status, headers });
}

function computeSitemapXml(resources: Map<string, ResourceInfo>, config: SiteConfig, localOrigin: string | undefined): string {
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ];
    const notFoundResourceCanonicalPath = findResource('/404', resources)?.canonicalPath;
    const canonicalPaths = [...resources.values()]
        .filter(v => v.includeInOutput && (v.extension === '.html' || v.extension === '.md') && v.canonicalPath !== notFoundResourceCanonicalPath)
        .map(v => v.canonicalPath)
        .sort();
    for (const canonicalPath of canonicalPaths) {
        lines.push('  <url>');
        lines.push(`    <loc>${localOrigin || config.siteMetadata.origin || ''}${canonicalPath}</loc>`);
        lines.push('  </url>');
    }
    lines.push('</urlset>');
    return lines.join('\n');
}
