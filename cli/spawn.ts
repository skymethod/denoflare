// deno-lint-ignore-file no-explicit-any

// 1.24.0 version
export interface SpawnOutput  {
    get stdout(): Uint8Array;
    get stderr(): Uint8Array;
    success: boolean;
    code: number;
    signal: Deno.Signal | null;
}

export async function spawn(command: string | URL, options?: { args?: string[], env?: Record<string, string> }): Promise<SpawnOutput> {
    // use Deno.Command if 1.28+, spawn is deprecated
    if ('Command' in Deno) {
        const c = new (Deno as any).Command(command, options);
        return await c.output();
    }

    // use Deno.spawn if < 1.28, not deprecated
    if ('spawn' in Deno) {
        const rt = await (Deno as any).spawn(command, options) as any;

        // pre-1.24.0, success, code, and signal were under a .status property
        // https://deno.com/blog/v1.24#updates-to-new-subprocess-api
        if (typeof rt.status === 'object') {
            const { success, code, signal } = rt.status;
            if (typeof success === 'boolean' && typeof code === 'number' && signal !== undefined) {
                rt.success = success;
                rt.code = code;
                rt.signal = signal;
                delete rt.status;
            } else {
                throw new Error(`Unexpected pre-1.24.0 spawn output status object`);
            }
        }
        return rt;
    }

    throw new Error(`Unable to spawn subprocess: did not find 'Deno.Command' or 'Deno.spawn'`);
}
