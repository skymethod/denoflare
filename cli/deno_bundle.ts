import { spawn } from './spawn.ts';

export interface DenoBundleResult {
    readonly code: string;
    readonly diagnostics: Deno.Diagnostic[];
}

export async function denoBundle(rootSpecifier: string, opts: { noCheck?: boolean | string, check?: boolean | string, compilerOptions?: { lib?: string[] } } = {}): Promise<DenoBundleResult> {
    const { noCheck, check, compilerOptions } = opts;
    let config: string | undefined;
    try {
        if (compilerOptions?.lib) {
            config = await Deno.makeTempFile({ prefix: 'denoflare-deno-bundle', suffix: '.json'});
            await Deno.writeTextFile(config, JSON.stringify({ compilerOptions }));
        }
    
        const { out, err, success } = await runDenoBundle(rootSpecifier, { config, noCheck, check });
        let code = out;
        let diagnostics: Deno.Diagnostic[] = [];
        if (err.length > 0 || !success) {
            diagnostics = parseDiagnostics(err);
            if (code.length === 0) {
                const { out } = await runDenoBundle(rootSpecifier, { config, noCheck: true });
                if (out.length > 0) code = out;
            }
        }
        return { code, diagnostics };
    } finally {
        if (config) {
            await Deno.remove(config);
        }
    }
}

//

type RunDenoBundleResult = { code: number, success: boolean, out: string, err: string };

async function runDenoBundle(rootSpecifier: string, opts: { noCheck?: boolean | string, check?: boolean | string, config?: string } = {}): Promise<RunDenoBundleResult> {
    const { noCheck, check, config } = opts;
    const computeBooleanOrStringArgs = (name: string, value?: boolean | string) => typeof value === 'string' ? [ `${name}=${value}` ] : value ? [ name ] : [];
    const args = [
        'bundle',
        ...computeBooleanOrStringArgs('--noCheck', noCheck), // local type-checking is still the default in `deno bundle` in 1.23.0, the first release where it is not the default in `deno run`
        ...computeBooleanOrStringArgs('--check', check),
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

function parseDiagnostics(err: string): Deno.Diagnostic[] {
    const rt: Deno.Diagnostic[] = [];
    if (err.length === 0) return rt;

    for (const [ _, codeStr, inBetween, fileName, lineStr, charStr ] of [...err.matchAll(/TS(\d+)(.*?)\s+at\s+([^\s]+):(\d+):(\d+)\n/gs)]) {
        const messageText = inBetween.trim();
        const code = parseInt(codeStr);
        const line = parseInt(lineStr);
        const character = parseInt(charStr);
        rt.push({ category: 1 /*error*/, code, messageText, fileName, start: { line, character } });
    }
    return rt;
}
