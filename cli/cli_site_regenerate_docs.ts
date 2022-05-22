import { denoflareCliCommand } from './cli_common.ts';
import { join } from './deps_cli.ts';
import { directoryExists } from './fs_util.ts';
import { DENOFLARE_COMMAND } from './cli.ts';
import { SERVE_COMMAND } from './cli_serve.ts';
import { PUSH_COMMAND } from './cli_push.ts';
import { TAIL_COMMAND } from './cli_tail.ts';
import { SITE_COMMAND } from './cli_site.ts';
import { SITE_GENERATE_COMMAND } from './cli_site_generate.ts';
import { SITE_SERVE_COMMAND } from './cli_site_serve.ts';
import { CliCommand } from './cli_command.ts';

export const SITE_REGENERATE_DOCS_COMMAND = denoflareCliCommand(['site', 'regenerate-docs'], '')
    .arg('docsRepoDir', 'string', '')
    ;

export async function regenerateDocs(args: (string | number)[], options: Record<string, unknown>) {
    if (SITE_REGENERATE_DOCS_COMMAND.dumpHelp(args, options)) return;

    const { docsRepoDir } = SITE_REGENERATE_DOCS_COMMAND.parse(args, options);
    
    if (!await directoryExists(docsRepoDir)) throw new Error(`Bad docsRepoDir: ${docsRepoDir}, must exist`);

    let madeChanges = false;
    const replace = async (path: string, command: CliCommand<unknown>) => {
        const absPath = join(docsRepoDir, path);
        const oldContents = await Deno.readTextFile(absPath);
        const helpContents = command.computeHelp();
        const newContents = oldContents.replace(new RegExp(command.command.join('-') + '.*?```', 's'), helpContents + '\n```');
        if (newContents !== oldContents) {
            console.log(`${path} changed!`);
            await Deno.writeTextFile(absPath, newContents);
            madeChanges = true;
        }
    };
    await replace('./cli/index.md', DENOFLARE_COMMAND);
    await replace('./cli/serve.md', SERVE_COMMAND);
    await replace('./cli/push.md', PUSH_COMMAND);
    await replace('./cli/tail.md', TAIL_COMMAND);
    await replace('./cli/site/index.md', SITE_COMMAND);
    await replace('./cli/site/generate.md', SITE_GENERATE_COMMAND);
    await replace('./cli/site/serve.md', SITE_SERVE_COMMAND);
    if (!madeChanges) console.log('no changes');
}
