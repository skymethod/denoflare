import { serve, SERVE_COMMAND } from './cli_serve.ts';
import { tail, TAIL_COMMAND } from './cli_tail.ts';
import { push, PUSH_COMMAND } from './cli_push.ts';
import { pushLambda, PUSH_LAMBDA_COMMAND } from './cli_push_lambda.ts';
import { site, SITE_COMMAND } from './cli_site.ts';
import { parseFlags } from './flag_parser.ts';
import { CLI_VERSION } from './cli_version.ts';
import { analytics, ANALYTICS_COMMAND } from './cli_analytics.ts';
import { cfapi, CFAPI_COMMAND } from './cli_cfapi.ts';
import { r2, R2_COMMAND } from './cli_r2.ts';
import { pubsub, PUBSUB_COMMAND } from './cli_pubsub.ts';
import { CliCommand } from './cli_command.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { d1, D1_COMMAND } from './cli_d1.ts';
import { AE_PROXY_COMMAND, aeProxy } from './cli_ae_proxy.ts';
import { PUSH_DEPLOY_COMMAND, pushDeploy } from './cli_push_deploy.ts';

const { args, options } = parseFlags(Deno.args);

const VERSION_COMMAND = denoflareCliCommand('version', 'Dump cli version');

export const DENOFLARE_COMMAND = CliCommand.of(['denoflare'], undefined, { version: CLI_VERSION })
    .subcommand(SERVE_COMMAND, serve)
    .subcommand(PUSH_COMMAND, push)
    .subcommand(PUSH_LAMBDA_COMMAND, pushLambda)
    .subcommand(PUSH_DEPLOY_COMMAND, pushDeploy)
    .subcommand(TAIL_COMMAND, tail)
    .subcommand(SITE_COMMAND, site)
    .subcommand(ANALYTICS_COMMAND, analytics)
    .subcommand(CFAPI_COMMAND, cfapi)
    .subcommand(R2_COMMAND, r2)
    .subcommand(PUBSUB_COMMAND, pubsub)
    .subcommand(D1_COMMAND, d1)
    .subcommand(AE_PROXY_COMMAND, aeProxy)
    .subcommand(VERSION_COMMAND, () => console.log(CLI_VERSION))
    ;

if (import.meta.main) {
    await DENOFLARE_COMMAND.routeSubcommand(args, options);
}
