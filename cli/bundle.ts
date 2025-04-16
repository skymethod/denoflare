import { CliCommand } from './cli_command.ts';
import { parseNameValuePairsOption } from './cli_common.ts';
import { denoBundle, DenoDiagnostic } from './deno_bundle.ts';
import { resolve, toFileUrl, isAbsolute } from './deps_cli.ts';
import { fileExists } from './fs_util.ts';
import { Bytes } from '../common/bytes.ts';
import { denoCheck } from './deno_check.ts';
import { tryParseUrl } from '../common/check.ts';
import { versionCompare } from './versions.ts';

export type BundleBackend = 'builtin' | 'process' | 'module' | 'esbuild';

export type TypeCheckLevel = 'all' | 'local' | 'none';

export type BundleOpts = { backend?: BundleBackend, check?: TypeCheckLevel, createSourceMap?: boolean, compilerOptions?: { lib?: string[] }, rest?: Record<string, string> };

export function commandOptionsForBundle(command: CliCommand<unknown>) {
    return command
        .optionGroup()
        .option('bundle', 'name-value-pairs', `Advanced options used when emitting javascript bundles: backend=(${computeSupportedBackends().join('|')}), check=(${supportedChecks.join('|')})`)
        ;
}

export function parseBundleOpts(options: Record<string, unknown>): BundleOpts | undefined {
    const nvps = parseNameValuePairsOption('bundle', options);
    if (nvps === undefined) return undefined;
    const { backend, check, ...rest } = nvps;
    const supportedBackends = computeSupportedBackends();
    if (backend && !supportedBackends.includes(backend)) throw new Error(`Bad backend: ${backend}, expected one of (${supportedBackends.join(', ')})`);
    if (check && !supportedChecks.includes(check)) throw new Error(`Bad check: ${check}, expected one of (${supportedChecks.join(', ')})`);
    return { backend: backend as BundleBackend, check: check as TypeCheckLevel, rest };
}

export async function bundle(rootSpecifier: string, opts: BundleOpts = {}): Promise<{ code: string, sourceMap?: string, backend: BundleBackend }> {
    const { backend, check, createSourceMap, compilerOptions, rest = {} } = opts;

    // deno-lint-ignore no-explicit-any
    const deno = Deno as any;
    if ('emit' in deno && 'formatDiagnostics' in deno && backend === undefined || backend === 'builtin') {
        // < 1.22
        const result = await deno.emit(rootSpecifier, {
            bundle: 'module',
            compilerOptions,
        });
        // deno-lint-ignore no-explicit-any
        const blockingDiagnostics = result.diagnostics.filter((v: any) => !isKnownIgnorableWarning(v))
        if (blockingDiagnostics.length > 0) {
            console.warn(deno.formatDiagnostics(blockingDiagnostics));
            throw new Error('bundle failed');
        }
        const bundleJs = result.files['deno:///bundle.js'];
        if (typeof bundleJs !== 'string') throw new Error(`bundle.js not found in bundle output files: ${Object.keys(result.files).join(', ')}`);
        const bundleJsMap = result.files['deno:///bundle.js.map'];
        if (createSourceMap) {
            if (typeof bundleJsMap !== 'string') throw new Error(`bundle.js.map not found in bundle output files: ${Object.keys(result.files).join(', ')}`);
        }
        const sourceMap = createSourceMap ? bundleJsMap : undefined;
        return { code: bundleJs, sourceMap, backend: 'builtin' };
    }

    // 1.22+
    // Deno.emit is gone

    if (backend === 'module' || createSourceMap) {
        // the new deno_emit module is the official replacement, but is not nearly as functional as Deno.emit
        //  - no type checking, and none planned: https://github.com/denoland/deno_emit/issues/27
        //  - fails with some remote imports: https://github.com/denoland/deno_emit/issues/17

        if (check && check !== 'none') throw new Error(`Bundle ${backend} backend does not support type checking, and it probably never will. https://github.com/denoland/deno_emit/issues/27`);
        // the 'bundle' module function is closer to what we were doing with Deno.emit before

        // dynamic import, otherwise fails pre 1.22, and avoid typecheck failures using two lines
        const moduleUrl = 'https://deno.land/x/emit@0.16.0/mod.ts';
        const { bundle } = await import(moduleUrl);

        // new 'bundle' no longer takes abs file paths
        // https://github.com/denoland/deno_emit/issues/22
        if (!/^(file|https):\/\//.test(rootSpecifier) && await fileExists(rootSpecifier)) {
            // also does not handle relative file paths
            if (!isAbsolute(rootSpecifier)) {
                rootSpecifier = resolve(Deno.cwd(), rootSpecifier);
            }
            rootSpecifier = toFileUrl(rootSpecifier).toString();
        }
        // supposedly better, but not apparently: https://github.com/denoland/deno_emit/issues/17
        const rootUrl = new URL(rootSpecifier);

        let { code } = await bundle(rootUrl);

        // currently unable to disable inline source maps
        // https://github.com/denoland/deno_emit/issues/25
        const i = code.indexOf('\n//# sourceMappingURL=');
        let sourceMap: string | undefined;
        if (i > 0) {
            const sourceMapDataUrl = code.substring(i + '\n//# sourceMappingURL='.length);
            if (!sourceMapDataUrl.startsWith('data:application/json;base64,')) throw new Error(`Unsupported source map`);
            sourceMap = Bytes.ofBase64(sourceMapDataUrl.substring('data:application/json;base64,'.length)).utf8();
            code = code.substring(0, i);
        }
        return { code, sourceMap, backend: 'module' };
    }

    // deno bundle is finally going away in deno 2
    // the way forward is esbuild and esbuild-deno-loader
    if (backend === 'esbuild' || versionCompare(Deno.version.deno, '2.0.0') >= 0) {
        // TODO verify existing transformations or include in custom plugin?
        // TODO other esbuild options?

        // deno bundle type-checked by default, so we will too (not handled by esbuild or esbuild deno loader)
        if (check !== 'none') {
            const all = check === 'all';
            const { diagnostics } = await denoCheck(rootSpecifier, { all, compilerOptions });
            if (diagnostics.length > 0) {
                console.warn(diagnostics.map(formatDiagnostic).join('\n\n'));
                throw new Error('deno check failed');
            }
        }

        let configPath: string | undefined;
        try {
            if (compilerOptions?.lib) {
                configPath = await Deno.makeTempFile({ prefix: 'denoflare-esbuild-bundle', suffix: '.json'});
                await Deno.writeTextFile(configPath, JSON.stringify({ compilerOptions, lock: false }));
            }
            const { loader = 'native', loaderModule = '^0.11.1', esbuildModule = '0.25.2', ...unknownOptions } = rest;
            if (Object.keys(unknownOptions).length > 0) throw new Error(`Unknown esbuild bundler option${Object.keys(unknownOptions).length === 1 ? '' : 's'}: ${JSON.stringify(unknownOptions)}`);

            if (loader !== 'native' && loader !== 'portable') throw new Error(`Invalid esbuild loader: expected 'native' or 'portable'`);

            const esbuildModuleUrl = tryParseUrl(esbuildModule) ? esbuildModule : loader === 'native' ? `npm:esbuild@${esbuildModule}` : `https://deno.land/x/esbuild@v${esbuildModule}/wasm.js`;
            const esbuild = await import(esbuildModuleUrl);
            const loaderModuleUrl = tryParseUrl(loaderModule) ? loaderModule : `jsr:@luca/esbuild-deno-loader@${loaderModule}`;
            const { denoPlugins } = await import(loaderModuleUrl);

            type OutputFile = { path: string, contents: Uint8Array, hash: string, text: string };
            type BuildResult = { errors: unknown[], warnings: unknown[], outputFiles: OutputFile[], metafile: unknown, mangleCache: unknown};
            const result = await esbuild.build({
                plugins: [ ...denoPlugins({ loader, configPath }) ],
                entryPoints: [ rootSpecifier ],
                outfile: 'output.esm.js',
                write: false,
                bundle: true,
                platform: 'browser',
                format: 'esm',
            }) as BuildResult;
            if (result.errors.length > 0 || result.warnings.length > 0 || result.outputFiles.length !== 1) throw new Error(`Unexpected esbuild result: ${JSON.stringify(result)}`);

            const code = result.outputFiles[0].text;
            return { code, backend: 'esbuild' };
        } finally {
            if (configPath) {
                await Deno.remove(configPath);
            }
        }
    }
    // default: spawn 'deno bundle' process
    // deno bundle performs local type-checking by default
    const check_ = check === 'all' ? 'all' : undefined;
    const noCheck = check === 'none' ? true : undefined;
    const { code, diagnostics } = await denoBundle(rootSpecifier, { compilerOptions, check: check_, noCheck });
    const blockingDiagnostics = diagnostics.filter(v => !isKnownIgnorableWarning(v))
    if (blockingDiagnostics.length > 0) {
        console.warn(blockingDiagnostics.map(formatDiagnostic).join('\n\n'));
        throw new Error('bundle failed');
    }
    return { code, backend: 'process' };
}

//

const supportedChecks = [ 'all', 'local', 'none' ];

function computeSupportedBackends() {
    // deno-lint-ignore no-explicit-any
    const deno = Deno as any;
    const builtinSupported = 'emit' in deno && 'formatDiagnostics' in deno;
    return [ ...(builtinSupported ? [ 'builtin' ] : []), 'process', 'module', 'esbuild' ];
}

function isKnownIgnorableWarning(diag: DenoDiagnostic): boolean {
    return isModuleJsonImportWarning(diag)
        || isSubsequentVariableDeclarationsInDenoLibsWarning(diag);
}

function isModuleJsonImportWarning(diag: DenoDiagnostic): boolean {
    /*
    these seem to be non-fatal
    possibly a deno bug: https://github.com/denoland/deno/issues/13448
    {
      category: 1,
      code: 7042,
      start: { line: 3, character: 21 },
      end: { line: 3, character: 38 },
      messageText: "Module './whatever.json' was resolved to 'file:///file/to/whatever.json', but '--resolveJsonModule' is not used.",
      messageChain: null,
      source: null,
      sourceLine: "import whatever from './whatever.json' assert { type: 'json' };",
      fileName: "file:///path/to/whatever.ts",
      relatedInformation: null
    },
    */
    return diag.category === 1 && diag.code === 7042;
}

function isSubsequentVariableDeclarationsInDenoLibsWarning(diag: DenoDiagnostic): boolean {
    /*
    these seem to be non-fatal
    {                                                                                                                           
        category: 1,                                                                                                              
        code: 2403,                                                                                                               
        start: { line: 171, character: 12 },                                                                                      
        end: { line: 171, character: 20 },                                                                                        
        messageText: "Subsequent variable declarations must have the same type.  Variable 'location' must be of type 'Loca...",   
        messageChain: null,                                                                                                       
        source: null,                                                                                                             
        sourceLine: "declare var location: WorkerLocation;",                                                                      
        fileName: "asset:///lib.deno.worker.d.ts",                                                                                
        relatedInformation: [                                                                                                     
            {                                                                                                                       
            category: 3,                                                                                                          
            code: 6203,                                                                                                           
            start: { line: 165, character: 12 },                                                                                  
            end: { line: 165, character: 20 },                                                                                    
            messageText: "'location' was also declared here.",                                                                    
            messageChain: null,                                                                                                   
            source: null,                                                                                                         
            sourceLine: "declare var location: Location;",                                                                        
            fileName: "asset:///lib.deno.window.d.ts",                                                                            
            relatedInformation: null                                                                                              
            }                                                                                                                       
        ]                                                                                                                         
    }                                                                                                                           
    */
    return diag.category === 1 && diag.code === 2403 && (diag.fileName || '').startsWith('asset:///lib.deno.');
}

function formatDiagnostic(diagnostic: DenoDiagnostic): string {
    const { code, messageText, fileName, start } = diagnostic;
    const suffix = start ? `:${start.line}:${start.character}` : '';
    return `TS${code}: ${messageText}\n  at ${fileName}:${suffix}`;
}

