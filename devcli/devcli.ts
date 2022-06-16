import { CliCommand } from '../cli/cli_command.ts';
import { parseFlags } from '../cli/flag_parser.ts';
import { auth, AUTH_COMMAND } from './devcli_auth.ts';
import { generateNpm } from './devcli_generate_npm.ts';
import { generateNpmNew } from './devcli_generate_npm_new.ts';
import { generateReasonCodes } from './devcli_pubsub.ts';
import { tmp as r2Tmp } from './devcli_r2.ts';
import { regenerateDocs, REGENERATE_DOCS_COMMAND } from './devcli_regenerate_docs.ts';

const { args, options } = parseFlags(Deno.args);

export const DENOFLAREDEV_COMMAND = CliCommand.of(['denoflaredev'])
    .subcommand(AUTH_COMMAND, auth)
    .subcommand(REGENERATE_DOCS_COMMAND, regenerateDocs)
    ;

if (import.meta.main) {
    await DENOFLAREDEV_COMMAND.routeSubcommand(args, options, { generateNpm, generateNpmNew, generateReasonCodes, r2Tmp });
}
