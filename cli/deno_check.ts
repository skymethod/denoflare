import { DenoDiagnostic, DenoDiagnosticCategory, parseDiagnostics } from './deno_bundle.ts';
import { spawn } from './spawn.ts';

export interface DenoCheckResult {
    readonly success: boolean;
    readonly diagnostics: DenoDiagnostic[];
}

export async function denoCheck(rootSpecifier: string, opts: { all?: boolean, compilerOptions?: { lib?: string[] } } = {}): Promise<DenoCheckResult> {
    const { all, compilerOptions } = opts;

    let config: string | undefined;
    try {
        if (compilerOptions?.lib) {
            config = await Deno.makeTempFile({ prefix: 'denoflare-deno-check', suffix: '.json'});
            await Deno.writeTextFile(config, JSON.stringify({ compilerOptions }));
        }
        const { out, err, success } = await runDenoCheck(rootSpecifier, { all, config });
        console.log({ out, err, success });

        let diagnostics: DenoDiagnostic[] = [];
        if (err.length > 0 || !success) {
            diagnostics = parseDiagnostics(err);
            if (!success && err && diagnostics.length === 0) {
                // unparsed error (e.g. deno bundle not supporting npm specifiers)
                diagnostics.push({
                    category: DenoDiagnosticCategory.Error,
                    code: 0,
                    messageText: err,
                });
            }
        }

        return { success, diagnostics };
    } finally {
        if (config) {
            await Deno.remove(config);
        }
    }
}

//

type RunDenoCheckResult = { code: number, success: boolean, out: string, err: string };

async function runDenoCheck(rootSpecifier: string, opts: { all?: boolean, config?: string } = {}): Promise<RunDenoCheckResult> {
    const { all, config } = opts;
    const args = [
        'check',
        '--allow-import',
        '--no-lock',
        ...(all ? [ '--all' ] : []),
        ...(config ? ['--config', config] : []),
        rootSpecifier,
    ];
    const { code, success, stdout, stderr } = await spawn(Deno.execPath(), {
        args,
        env: {
            NO_COLOR: '1', // to make parsing the output easier
        }
    });
    const out = new TextDecoder().decode(stdout);
    const err = new TextDecoder().decode(stderr);
    return { code, success, out, err };
}
