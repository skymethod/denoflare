import { checkString } from '../common/check.ts';
import { CliStats } from './cli_common.ts';
import { CLI_VERSION } from './cli_version.ts';
import { ensureDir, resolve } from './deps_cli.ts';
import { fileExists } from './fs_util.ts';
import { RepoDir } from './repo_dir.ts';
import { InputFileInfo, SiteModel } from './site/site_model.ts';

export async function generate(args: (string | number)[], options: Record<string, unknown>) {
    if (options.help || args.length < 2) {
        dumpHelp();
        return;
    }

    const verbose = !!options.verbose;

    const repoDir = await RepoDir.of(resolve(Deno.cwd(), checkString('repoDir', args[0])));

    let outputDir = args[1];
    if (typeof outputDir !== 'string') throw new Error(`Bad outputDir: ${outputDir}`);
    if (await fileExists(outputDir)) throw new Error(`Bad outputDir, exists as file: ${outputDir}`);
    outputDir = resolve(Deno.cwd(), outputDir);

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

//

function dumpHelp() {
    const lines = [
        `denoflare-site-generate ${CLI_VERSION}`,
        'Generate static output for Cloudfare Pages',
        '',
        'USAGE:',
        '    denoflare site generate [FLAGS] [OPTIONS] [repo-dir] [output-dir]',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'ARGS:',
        '    <repo-dir>      Local path to the git repo to use as the source input for generation',
        '    <output-dir>    Local path to the directory to use for generated output',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
