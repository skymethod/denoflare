import { checkString } from '../common/check.ts';
import { CLI_VERSION } from './cli_version.ts';
import { resolve } from './deps_cli.ts';
import { computeFileInfoVersion } from './fs_util.ts';
import { RepoDir } from './repo_dir.ts';
import { InputFileInfo, SiteModel } from './site/site_model.ts';

export async function serve(args: (string | number)[], options: Record<string, unknown>) {
    if (options.help || args.length < 1) {
        dumpHelp();
        return;
    }

    const verbose = !!options.verbose;
    if (verbose) RepoDir.VERBOSE = true;

    const watch = !!options.watch;

    let port = DEFAULT_PORT;
    if (typeof options.port === 'number') {
        port = options.port;
    }
    const localOrigin = `http://localhost:${port}`;

    const repoDir = await RepoDir.of(resolve(Deno.cwd(), checkString('repoDir', args[0])));
    const siteModel = new SiteModel(repoDir.path, { localOrigin });

    const buildSite = async () => {
        const start = Date.now();
        console.log('Building site...');
        const inputFiles: InputFileInfo[] = (await repoDir.listFiles({ stat: true })).map(v => ({ path: v.path, version: computeFileInfoVersion(v.info!) }));
        await siteModel.setInputFiles(inputFiles);
        console.log(`Built site, took ${Date.now() - start}ms`);
    };
    if (watch) {
        let timeoutId: number | undefined;
        repoDir.startWatching(_events => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(async () => {
                await buildSite();
            }, 50);
        });
    }
    
    await buildSite();
    
    const server = Deno.listen({ port });
    console.log(`Local server running on ${localOrigin}`);

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

const DEFAULT_PORT = 8099;

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
        'OPTIONS:',
        `        --port <number>     Local port to use for the http server (default: ${DEFAULT_PORT})`,
        '',
        'ARGS:',
        '    <repo-dir>      Local path to the git repo to use as the source input',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
