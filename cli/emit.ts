import { CliCommand } from './cli_command.ts';
import { parseNameValuePairsOption } from './cli_common.ts';
import { denoBundle } from './deno_bundle.ts';
import { toFileUrl } from './deps_cli.ts';
import { fileExists } from './fs_util.ts';

export type EmitBackend = 'process' | 'module' | 'builtin';

export type EmitOpts = { backend?: EmitBackend, compilerOptions?: { lib?: string[] } };

export function commandOptionsForEmit(command: CliCommand<unknown>) {
    return command
        .optionGroup()
        .option('emit', 'name-value-pairs', `Advanced options used when emitting javascript bundles: backend=(${computeSupportedBackends().join(', ')})`)
        ;
}

export function parseEmitOpts(options: Record<string, unknown>): EmitOpts | undefined {
    const nvps = parseNameValuePairsOption('emit', options);
    if (nvps === undefined) return undefined;
    const { backend } = nvps;
    const supportedBackends = computeSupportedBackends();
    if (backend && !supportedBackends.includes(backend)) throw new Error(`Bad backend: ${backend}, expected one of (${supportedBackends.join(', ')})`);
    return { backend: backend as EmitBackend };
}

export async function emit(rootSpecifier: string, opts: EmitOpts = {}): Promise<{ code: string, backend: EmitBackend }> {
    const { backend, compilerOptions } = opts;
    
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
        return { code: bundleJs, backend: 'builtin' };
    }

    // 1.22+
    // Deno.emit is gone

    if (backend === 'module') {
        // the new deno_emit module is the official replacement, but is not nearly as functional as Deno.emit
        //  - no type checking, and none planned: https://github.com/denoland/deno_emit/issues/27
        //  - fails with some remote imports: https://github.com/denoland/deno_emit/issues/17

        // the 'bundle' module function is closer to what we were doing with Deno.emit before

        // dynamic import, otherwise fails pre 1.22, and avoid typecheck failures using two lines
        const moduleUrl = 'https://deno.land/x/emit@0.0.2/mod.ts';
        const { bundle } = await import(moduleUrl);  

        // new 'bundle' no longer takes abs file paths
        // https://github.com/denoland/deno_emit/issues/22
        if (!/^(file|https):\/\//.test(rootSpecifier) && await fileExists(rootSpecifier)) {
            rootSpecifier = toFileUrl(rootSpecifier).toString();
        }
        // supposedly better, but not apparently: https://github.com/denoland/deno_emit/issues/17
        const rootUrl = new URL(rootSpecifier);

        let { code } = await bundle(rootUrl);

        // currently unable to disable inline source maps
        // https://github.com/denoland/deno_emit/issues/25
        const i = code.indexOf('\n//# sourceMappingURL=');
        if (i > 0) {
            code = code.substring(0, i);
        }
        return { code, backend: 'module' };
    }

    // default: spawn 'deno bundle' process
    const { code, diagnostics } = await denoBundle(rootSpecifier, { compilerOptions });
    const blockingDiagnostics = diagnostics.filter(v => !isKnownIgnorableWarning(v))
    if (blockingDiagnostics.length > 0) {
        console.warn(blockingDiagnostics.map(formatDiagnostic).join('\n\n'));
        throw new Error('bundle failed');
    }
    return { code, backend: 'process' };
}

//

function computeSupportedBackends() {
    // deno-lint-ignore no-explicit-any
    const deno = Deno as any;
    const builtinSupported = 'emit' in deno && 'formatDiagnostics' in deno;
    return [ 'process', 'module', ...(builtinSupported ? [ 'builtin'] : []) ];
}

function isKnownIgnorableWarning(diag: Deno.Diagnostic): boolean {
    return isModuleJsonImportWarning(diag) 
        || isSubsequentVariableDeclarationsInDenoLibsWarning(diag);
}

function isModuleJsonImportWarning(diag: Deno.Diagnostic): boolean {
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

function isSubsequentVariableDeclarationsInDenoLibsWarning(diag: Deno.Diagnostic): boolean {
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

function formatDiagnostic(diagnostic: Deno.Diagnostic): string {
    const { code, messageText, fileName, start} = diagnostic;
    const suffix = start ? `:${start.line}:${start.character}` : '';
    return `TS${code}: ${messageText}\n  at ${fileName}:${suffix}`;
}
