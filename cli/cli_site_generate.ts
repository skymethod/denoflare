import { CliStats, denoflareCliCommand } from './cli_common.ts';
import { ensureDir, resolve } from './deps_cli.ts';
import { fileExists } from './fs_util.ts';
import { RepoDir } from './repo_dir.ts';
import { InputFileInfo, SiteModel } from './site/site_model.ts';

export const SITE_GENERATE_COMMAND = denoflareCliCommand(['site', 'generate'], 'Develop and deploy a static docs site to Cloudflare Pages')
    .arg('repoDir', 'string', 'Local path to the git repo to use as the source input for generation')
    .arg('outputDir', 'string', 'Local path to the directory to use for generated output')
    .docsLink('/cli/site/generate')
    ;

export async function generate(args: (string | number)[], options: Record<string, unknown>) {
    if (SITE_GENERATE_COMMAND.dumpHelp(args, options)) return;

    const { verbose, repoDir: repoDirOpt, outputDir: outputDirOpt } = SITE_GENERATE_COMMAND.parse(args, options);

    const repoDir = await RepoDir.of(resolve(Deno.cwd(), repoDirOpt));

    if (await fileExists(outputDirOpt)) throw new Error(`Bad output-dir, exists as file: ${outputDirOpt}`);
    const outputDir = resolve(Deno.cwd(), outputDirOpt);

    const siteModel = new SiteModel(repoDir.path);
    
    // 3-7ms to here
    let start = Date.now();
    console.log('Building site...');
    const inputFiles: InputFileInfo[] = (await repoDir.listFiles()).map(v => ({ path: v.path, version: '0' }));
    await siteModel.setInputFiles(inputFiles);
    console.log(`Built site, took ${Date.now() - start}ms`);
    
    start = Date.now();
    if (verbose) console.log(`Ensuring dir exists: ${outputDir}`);
    await ensureDir(outputDir);
    console.log(`Writing output`);
    await siteModel.writeOutput(outputDir);
    console.log(`Wrote output to ${outputDir}, took ${Date.now() - start}ms`);
    console.log(`Done in ${Date.now() - CliStats.launchTime}ms`);
}
