import { createGraph, fromFileUrl, ModuleGraphJson, toFileUrl } from './deps_cli.ts';

export async function computeDenoGraphLocalPaths(path: string): Promise<string[]> {
    const graph = await createGraph(toFileUrl(path).toString());
    const obj = graph.toJSON();
    return findLocalPaths(obj);
}

//

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
