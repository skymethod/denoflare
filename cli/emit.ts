
export async function emit(rootSpecifier: string): Promise<string> {
    const result = await Deno.emit(rootSpecifier, {
        bundle: 'module',
    });
    const blockingDiagnostics = result.diagnostics.filter(v => !isKnownIgnorableWarning(v))
            if (blockingDiagnostics.length > 0) {
                console.warn(Deno.formatDiagnostics(blockingDiagnostics));
                throw new Error('bundle failed');
            }
    const bundleJs = result.files['deno:///bundle.js'];
    if (typeof bundleJs !== 'string') throw new Error(`bundle.js not found in bundle output files: ${Object.keys(result.files).join(', ')}`);
    return bundleJs;
}

//

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
