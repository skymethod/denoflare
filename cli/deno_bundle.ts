export interface DenoBundleResult {
    readonly code: string;
    readonly diagnostics: Deno.Diagnostic[];
}

export async function denoBundle(rootSpecifier: string, opts: { compilerOptions?: { lib?: string[] } } = {}): Promise<DenoBundleResult> {
    const { compilerOptions } = opts;
    let config: string | undefined;
    try {
        if (compilerOptions?.lib) {
            config = await Deno.makeTempFile({ prefix: 'denoflare-deno-bundle', suffix: '.json'});
            await Deno.writeTextFile(config, JSON.stringify({ compilerOptions }));
        }
    
        const { out, err, status } = await runDenoBundle(rootSpecifier, { config });
        let code = out;
        let diagnostics: Deno.Diagnostic[] = [];
        if (err.length > 0 || !status.success) {
            diagnostics = parseDiagnostics(err);
            const { out } = await runDenoBundle(rootSpecifier, { noCheck: true });
            if (code.length === 0 && out.length > 0) code = out;
        }
        return { code, diagnostics };
    } finally {
        if (config) {
            await Deno.remove(config);
        }
    }
}

//

type RunDenoBundleResult = { status: { success: boolean, code: number }, out: string, err: string };

async function runDenoBundle(rootSpecifier: string, opts: { noCheck?: boolean, config?: string } = {}): Promise<RunDenoBundleResult> {
    const{ noCheck, config } = opts;
    const { status, stdout, stderr } = await Deno.spawn(Deno.execPath(), {
        args: [
            'bundle',
            ...(noCheck ? ['--no-check'] : []),
            ...(config ? ['--config', config] : []),
            rootSpecifier,
        ],
        env: {
            NO_COLOR: '1', // to make parsing the output easier
        }
    });
    const out = new TextDecoder().decode(stdout);
    const err = new TextDecoder().decode(stderr);
    return { status, out, err };
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
