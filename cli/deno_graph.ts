import { createGraph, fromFileUrl, ModuleGraphJson, toFileUrl, isAbsolute, join, normalize } from './deps_cli.ts';

export async function computeDenoGraphLocalPaths(path: string): Promise<string[]> {
    const absolutePath = toAbsolutePath(path);
    const graph = await createGraph(toFileUrl(absolutePath).toString());
    const obj = graph.toJSON();
    return findLocalPaths(obj);
}

//

function toAbsolutePath(path: string): string {
    return isAbsolute(path) ? path : normalize(join(Deno.cwd(), path));
}

function findLocalPaths(graph: ModuleGraphJson): string[] {
    const rt = new Set<string>();
    for (const root of graph.roots) {
        const rootPath = fromFileUrl(root);
        rt.add(rootPath);
    }
    for (const { specifier } of graph.modules) {
        if (specifier.startsWith('file://')) {
            rt.add(fromFileUrl(specifier));
        }
    }
    return [...rt].sort();
}
