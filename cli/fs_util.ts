export async function fileExists(path: string): Promise<boolean> {
    return await exists(path, info => info.isFile);
}

export async function directoryExists(path: string): Promise<boolean> {
    return await exists(path, info => info.isDirectory);
}

export function computeFileInfoVersion(info: Deno.FileInfo): string {
    return `${info.size}|${info.mtime instanceof Date ? (info.mtime.getTime()) : ''}`;
}

//

async function exists(path: string, test: (info: Deno.FileInfo) => boolean) {
    try {
        const info = await Deno.stat(path);
        return test(info);
    } catch (e) {
        if (e instanceof Deno.errors.NotFound) {
            return false;
        } else {
            throw e;
        }
    }
}
