export interface DenoBundleResult {
    readonly code: string;
    readonly diagnostics: Deno.Diagnostic[];
}

export async function denoBundle(rootSpecifier: string): Promise<DenoBundleResult> {
    const { out, err, status } = await runDenoBundle(rootSpecifier);
    let code = out;
    let diagnostics: Deno.Diagnostic[] = [];
    if (err.length > 0 || !status.success) {
        diagnostics = parseDiagnostics(err);
        const { out } = await runDenoBundle(rootSpecifier, { noCheck: true });
        if (code.length === 0 && out.length > 0) code = out;
    }
    return { code, diagnostics };

}

//

type RunDenoBundleResult = { status: { success: boolean, code: number }, out: string, err: string };

async function runDenoBundle(rootSpecifier: string, opts: { noCheck?: boolean } = {}): Promise<RunDenoBundleResult> {
    const{ noCheck } = opts;
    const { status, stdout, stderr } = await Deno.spawn(Deno.execPath(), {
        args: [
            'bundle',
            ...(noCheck ? ['--no-check'] : []),
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

    for (const [ _, codeStr, fileName, lineStr, charStr ] of [...err.matchAll(/TS(\d+).*?\s+at\s+([^\s]+):(\d+):(\d+)\n/gs)]) {
        const code = parseInt(codeStr);
        const line = parseInt(lineStr);
        const character = parseInt(charStr);
        rt.push({ category: 1 /*error*/, code, fileName, start: { line, character } });
    }
    return rt;
}
