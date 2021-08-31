export async function fileExists(path: string): Promise<boolean> {
    try {
        const info = await Deno.stat(path);
        return info.isFile;
    } catch (e) {
        if (e instanceof Deno.errors.NotFound) {
            return false;
        } else {
            throw e;
        }
    }
}
