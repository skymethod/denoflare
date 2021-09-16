import { checkString } from '../common/check.ts';
import { CLI_VERSION } from './cli_version.ts';
import { resolve } from './deps_cli.ts';
import { RepoDir } from './repo_dir.ts';
import { InputFileInfo, SiteModel } from './site/site_model.ts';

export async function serve(args: (string | number)[], options: Record<string, unknown>) {
    if (options.help || args.length < 1) {
        dumpHelp();
        return;
    }

    const _verbose = !!options.verbose;

    const repoDir = await RepoDir.of(resolve(Deno.cwd(), checkString('repoDir', args[0])));

    const siteModel = new SiteModel(repoDir.path);
    
    const start = Date.now();
    console.log('Building site...');
    const inputFiles: InputFileInfo[] = (await repoDir.listFiles({ stat: true })).map(v => ({ path: v.path, version: computeInputFileInfoVersion(v.info!) }));
    await siteModel.setInputFiles(inputFiles);
    console.log(`Built site, took ${Date.now() - start}ms`);
    
    const port = 8099;
    const server = Deno.listen({ port });
    console.log(`Local server running on http://localhost:${port}`);

    async function handle(conn: Deno.Conn) {
        const httpConn = Deno.serveHttp(conn);
        for await (const { request, respondWith } of httpConn) {
            try {
                const response = await siteModel.handle(request);
                await respondWith(response).catch(e => console.error(`Error in respondWith`, e));
            } catch (e) {
                console.error('Error servicing request', e);
            }
        }
    }

    for await (const conn of server) {
        handle(conn).catch(e => console.error('Error in handle', e));
    }

}

//

function computeInputFileInfoVersion(info: Deno.FileInfo): string {
    return `${info.size}|${info.mtime instanceof Date ? (info.mtime.getTime()) : ''}`;
}

function dumpHelp() {
    const lines = [
        `denoflare-site-serve ${CLI_VERSION}`,
        'Host static Cloudflare Pages site locally',
        '',
        'USAGE:',
        '    denoflare site serve [FLAGS] [OPTIONS] [repo-dir]',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'ARGS:',
        '    <repo-dir>      Local path to the git repo to use as the source input for generation',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
