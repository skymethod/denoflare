import { denoflareCliCommand } from './cli_common.ts';
import { resolve } from './deps_cli.ts';
import { computeFileInfoVersion } from './fs_util.ts';
import { RepoDir } from './repo_dir.ts';
import { InputFileInfo, SiteModel } from './site/site_model.ts';

const DEFAULT_PORT = 8099;

export const SITE_SERVE_COMMAND = denoflareCliCommand(['site', 'serve'], 'Host a static Cloudflare Pages site in a local Deno web server')
    .arg('repoDir', 'string', 'Local path to the git repo to use as the source input')
    .option('port', 'integer', `Local port to use for the http server (default: ${DEFAULT_PORT})`)
    .option('watch', 'boolean', `If set, rebuild the site when file system changes are detected in <repo-dir>`)
    .docsLink('/cli/site/serve')
    ;

export async function serve(args: (string | number)[], options: Record<string, unknown>) {
    if (SITE_SERVE_COMMAND.dumpHelp(args, options)) return;

    const { verbose, repoDir: repoDirOpt, port: portOpt, watch } = SITE_SERVE_COMMAND.parse(args, options);

    if (verbose) RepoDir.VERBOSE = true;

    const port = portOpt ?? DEFAULT_PORT;
    const localOrigin = `http://localhost:${port}`;

    const repoDir = await RepoDir.of(resolve(Deno.cwd(), repoDirOpt));
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
                await respondWith(response).catch(e => console.error(`Error in respondWith`, e.stack || e));
            } catch (e) {
                console.error('Error servicing request', e.stack || e);
            }
        }
    }

    for await (const conn of server) {
        handle(conn).catch(e => console.error('Error in handle', e.stack || e));
    }

}
