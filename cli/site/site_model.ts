import { relative, resolve, extname, emptyDir, isAbsolute, dirname, ensureDir } from '../deps_cli.ts';
import { directoryExists } from '../fs_util.ts';
import { ParseError, parseJsonc } from '../jsonc.ts';
import { computeHtml } from './design.ts';
import { Page, readPageFromFile } from './page.ts';
import { SiteConfig } from './site_config.ts'
import { checkSiteConfig } from './site_config_validation.ts';

export class SiteModel {

    private readonly inputDir: string;
    private readonly resources = new Map<string, ResourceInfo>();

    constructor(inputDir: string) {
        if (!directoryExists(inputDir)) throw new Error(`Bad inputDir: ${inputDir}, must exist`);
        if (!isAbsolute(inputDir)) throw new Error(`Bad inputDir: ${inputDir}, must be absolute`);
        this.inputDir = inputDir;
    }

    async setInputFiles(files: InputFileInfo[]) {
        for (const file of files) {
            const inputPath = file.path;
            if (!isAbsolute(inputPath)) throw new Error(`Bad inputPath: ${inputPath}, must be absolute`);
            const path = computeResourcePath(inputPath, this.inputDir);
            let resource = this.resources.get(path);
            if (!resource) {
                const extension = extname(inputPath);
                const includeInOutput = shouldIncludeInOutput(path, extension);
                const canonicalPath = computeCanonicalResourcePath(path);
                resource = { inputPath, extension, includeInOutput, canonicalPath };
                this.resources.set(path, resource);
            }
        }

        const config = await computeConfig(this.resources);

        for (const [_, resource] of this.resources.entries()) {
            if (resource.extension === '.md') {
                const page = await readPageFromFile(resource.inputPath);
                const outputHtml = computeHtml(page.markdown, page, resource.canonicalPath, config, { verbose: false, dumpEnv: false });
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

//

interface ResourceInfo {
    readonly inputPath: string; // fs path to source file
    readonly extension: string; // with dot, e.g. .md
    readonly includeInOutput: boolean;
    readonly canonicalPath: string; // e.g. / for /index.html
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
    return replaceMdWithHtml(outputPath);
}

function computeResourcePath(inputFile: string, inputDir: string): string {
    if (!inputFile.startsWith(inputDir)) throw new Error(`Bad inputFile: ${inputFile}, must reside under ${inputDir}`);
    const relativePath = relative(inputDir, inputFile);
    if (relativePath.startsWith('/')) throw new Error(`Unexpected relative path: ${relativePath}, inputFile=${inputFile}, inputDir=${inputDir}`);
    return '/' + replaceMdWithHtml(relativePath);
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

function replaceMdWithHtml(path: string): string {
    return path.endsWith('.md') ? (path.substring(0, path.length - '.md'.length) + '.html') : path;
}
