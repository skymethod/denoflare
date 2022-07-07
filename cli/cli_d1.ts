import { denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForConfig, loadConfig, resolveProfile } from './config_loader.ts';
import { CloudflareApi, createD1Database, deleteD1Database, listD1Databases, queryD1Database } from '../common/cloudflare_api.ts';

const LIST_COMMAND = denoflareCliCommand(['d1', 'list'], `List databases`)
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#list')
    ;

const DROP_COMMAND = denoflareCliCommand(['d1', 'drop'], `Drop a database`)
    .arg('databaseName', 'string', 'Name of the database to drop')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#drop')
    ;

const CREATE_COMMAND = denoflareCliCommand(['d1', 'create'], `Create a database`)
    .arg('databaseName', 'string', 'Name of the database to create')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#create')
    ;

const QUERY_COMMAND = denoflareCliCommand(['d1', 'query'], `Query a database`)
    .arg('databaseName', 'string', 'Name of the database to query')
    .option('sql', 'string', 'SQL query to execute')
    .option('param', 'strings', 'Ordinal parameters for the query', { hint: 'value' })
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#query')
    ;
    
export const D1_COMMAND = denoflareCliCommand('d1', '') // until public beta
    .subcommand(LIST_COMMAND, list)
    .subcommand(DROP_COMMAND, drop)
    .subcommand(CREATE_COMMAND, create)
    .subcommand(QUERY_COMMAND, query)

    .docsLink('/cli/d1')
    ;

export async function d1(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    await D1_COMMAND.routeSubcommand(args, options);
}

//

async function list(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (LIST_COMMAND.dumpHelp(args, options)) return;

    const { verbose } = LIST_COMMAND.parse(args, options);
    if (verbose) CloudflareApi.DEBUG = true;
    const { accountId, apiToken } = await resolveProfile(await loadConfig(options), options);

    const dbs = await listD1Databases({ accountId, apiToken });
    console.log(dbs);
}

async function drop(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (DROP_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseName } = DROP_COMMAND.parse(args, options);
    if (verbose) CloudflareApi.DEBUG = true;
    const { accountId, apiToken } = await resolveProfile(await loadConfig(options), options);

    const db = (await listD1Databases({ accountId, apiToken })).find(v => v.name === databaseName);
    if (!db) throw new Error(`Database not found: ${databaseName}`);
    await deleteD1Database({ accountId, apiToken, databaseUuid: db.uuid });
}

async function create(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (CREATE_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseName } = CREATE_COMMAND.parse(args, options);
    if (verbose) CloudflareApi.DEBUG = true;
    const { accountId, apiToken } = await resolveProfile(await loadConfig(options), options);

    const db = await createD1Database({ accountId, apiToken, databaseName });
    console.log(db);
}

async function query(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (QUERY_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseName, sql, param } = QUERY_COMMAND.parse(args, options);
    if (verbose) CloudflareApi.DEBUG = true;
    const { accountId, apiToken } = await resolveProfile(await loadConfig(options), options);

    const db = (await listD1Databases({ accountId, apiToken })).find(v => v.name === databaseName);
    if (!db) throw new Error(`Database not found: ${databaseName}`);

    if (!sql) throw new Error(`Provide a query with --sql`);
    const queryResults = await queryD1Database({ accountId, apiToken, databaseUuid: db.uuid, sql, params: param });
    console.log(JSON.stringify(queryResults, undefined, 2));
}
