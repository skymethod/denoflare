import { generate, SITE_GENERATE_COMMAND } from './cli_site_generate.ts';
import { serve, SITE_SERVE_COMMAND } from './cli_site_serve.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { regenerateDocs, SITE_REGENERATE_DOCS_COMMAND } from './cli_site_regenerate_docs.ts';

export const SITE_COMMAND = denoflareCliCommand('site', 'Develop and deploy a static docs site to Cloudflare Pages')
    .subcommand(SITE_GENERATE_COMMAND, generate)
    .subcommand(SITE_SERVE_COMMAND, serve)
    .subcommand(SITE_REGENERATE_DOCS_COMMAND, regenerateDocs)
    ;

export async function site(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    await SITE_COMMAND.routeSubcommand(args, options);
}
