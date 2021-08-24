import { fromFileUrl } from './deps_cli.ts';

export async function computeDenoInfoLocalPaths(path: string): Promise<string[]> {
    const info = await computeDenoInfo(path);
    return findLocalPaths(info);
}

export async function computeDenoInfo(path: string): Promise<DenoInfo> {
    const p = Deno.run({
        cmd: [Deno.execPath(), 'info', '--json', path],
        stdout: 'piped',
        stderr: 'piped',
    });

    // await its completion
    const status = await p.status();
    const stdout = new TextDecoder().decode(await p.output());
    const stderr = new TextDecoder().decode(await p.stderrOutput());
    if (!status.success) {
        throw new Error(`deno info failed: ${JSON.stringify({ status, stdout, stderr})}`);
    }
    const obj = JSON.parse(stdout);
    // console.log(JSON.stringify(obj, undefined, 2));
    return obj as DenoInfo;
}

//

function findLocalPaths(info: DenoInfo): string[] {
    const rt = new Set<string>();
    const rootPath = fromFileUrl(info.root);
    rt.add(rootPath);
    for (const moduleInfo of info.modules) {
        rt.add(moduleInfo.local);
    }
    return [...rt].sort();
}

//

export interface DenoInfo {
    readonly root: string; // e.g. file:///...
    readonly modules: readonly ModuleInfo[];
    readonly size: number;
}

export interface ModuleInfo {
    readonly specifier: string; // e.g. file:///  or https://...
    readonly dependencies: readonly DependencyInfo[];
    readonly size: number;
    readonly mediaType: string; // e.g. Dts, TypeScript
    readonly local: string; // e.g. /path/to/source
    readonly checksum: string; // e.g. f182ca01c68d2d914db5016db3d74c123651286ba6b95e26f0231e84b867f896
    readonly emit?: string; // e.g. /path/to/deno/cache
    readonly error?: string;  // e.g. Cannot resolve module...
}

export interface DependencyInfo {
    readonly specifier: string; // e.g. ../asdf.ts or https://
    readonly code: string; // e.g. file:///asdf or https://
}
