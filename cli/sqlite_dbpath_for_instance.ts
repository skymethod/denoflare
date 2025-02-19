// only import if used
// import { DenoDir } from 'https://esm.sh/jsr/@deno/cache-dir@0.11.1';
import { ComputeDbPathForInstance } from '../common/storage/sqlite_durable_object_storage.ts';
import { join } from './deps_cli.ts';

export const sqliteDbPathForInstance: ComputeDbPathForInstance = async ({ container, className, id }: { container: string, className: string, id: string }) => {
    return join(await computeSqliteDosqlDirectory(), `${container}-${className}-${id}.db`);
}

export async function computeSqliteDosqlDirectory(): Promise<string> {
    const { DenoDir } = await import('https://esm.sh/jsr/@deno/cache-dir@0.11.1' + '');
    const root = DenoDir.tryResolveRootPath(undefined);
    if (root === undefined) throw new Error(`Unable to resolve deno cache dir`);
    const denoflareDosqlDir = join(root, 'denoflare', 'dosql');
    await Deno.mkdir(denoflareDosqlDir, { recursive: true });
    return denoflareDosqlDir;
}
