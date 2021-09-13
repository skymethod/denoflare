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
    private readonly resources = new Map<string, ResourceInfo>();

    private currentManifestPath: string | undefined;

    constructor(inputDir: string) {
        if (!directoryExists(inputDir)) throw new Error(`Bad inputDir: ${inputDir}, must exist`);
        if (!isAbsolute(inputDir)) throw new Error(`Bad inputDir: ${inputDir}, must be absolute`);
        this.inputDir = inputDir;
    }

    async setInputFiles(files: InputFileInfo[]) {
        const contentUpdateTime = Date.now();

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

        // read frontmatter from all md
        for (const [_, resource] of this.resources.entries()) {
            if (resource.extension === '.md') {
                resource.page = await readPageFromFile(resource.inputPath);
            }
        }

        // construct sidebar
        const sidebarInputItems: SidebarInputItem[] = [...this.resources.entries()]
            .filter(v => v[1].extension === '.md')
            .map(v => ({ 
                title: v[1].page!.titleResolved, 
                path: v[1].canonicalPath,
                hidden: v[1].page!.frontmatter.hidden,
                hideChildren: v[1].page!.frontmatter.hideChildren,
                order: v[1].page!.frontmatter.order,
            }));
        const sidebar = computeSidebar(sidebarInputItems);

        // transform markdown into html
        for (const [_, resource] of this.resources.entries()) {
            if (resource.extension === '.md') {
                const { canonicalPath: path, contentRepoPath } = resource;
                const { inputDir } = this;
                const page = resource.page!;
                const outputHtml = await computeHtml({ inputDir, page, path, contentRepoPath, config, sidebar, contentUpdateTime, manifestPath, verbose: false, dumpEnv: false });
                resource.outputText = outputHtml;
            }
        }
    }

    async writeOutput(outputDir: string) {
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

}

export interface InputFileInfo {
    readonly path: string;
    readonly version: string;
}

export function replaceSuffix(path: string, fromSuffix: string, toSuffix: string, opts: { required?: boolean } = { }): string {
    const { required } = opts;
    const endsWith = path.endsWith(fromSuffix);
    if (!endsWith && !!required) throw new Error(`Bad path: ${path}, expected to end in suffix: ${fromSuffix}`);
    return endsWith ? (path.substring(0, path.length - fromSuffix.length) + toSuffix) : path;
}

//

interface ResourceInfo {
    readonly inputPath: string; // fs path to source file
    readonly extension: string; // with dot, e.g. .md
    readonly includeInOutput: boolean;
    readonly canonicalPath: string; // e.g. / for /index.html
    readonly contentRepoPath: string; // e.g. /index.md
    page?: Page;
    outputText?: string;
}

//

const EXTENSIONS_TO_INCLUDE_IN_OUTPUT = new Set([
    '.html',
    '.ico',
    '.jpg',
    '.json',
    '.md',
    '.png',
    '.svg',
    '.txt',
]);

function shouldIncludeInOutput(path: string, extension: string): boolean {
    if (path === '/config.json' || path === '/config.jsonc') return false;
    return path === '/_redirects' || EXTENSIONS_TO_INCLUDE_IN_OUTPUT.has(extension);
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
