import { denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForConfig, loadConfig, resolveProfile } from './config_loader.ts';
import { CloudflareApi, createD1Backup, createD1Database, D1ImportAction, deleteD1Database, downloadD1Backup, exportD1Database, getD1DatabaseMetadata, importIntoD1Database, listD1Backups, listD1Databases, queryD1Database, rawQueryD1Database, restoreD1Backup } from '../common/cloudflare_api.ts';
import { checkEqual, isValidUrl } from '../common/check.ts';
import { Bytes } from '../common/bytes.ts';
import { normalize, TextLineStream } from './deps_cli.ts';
import { join } from './deps_cli.ts';
import { D1DumpOptions } from '../common/cloudflare_api.ts';
import { computeMd5 } from './wasm_crypto.ts';

export const LIST_COMMAND = denoflareCliCommand(['d1', 'list'], `List databases`)
    .option('name', 'string', 'A database name to search for')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#list')
    ;

export const GET_COMMAND = denoflareCliCommand(['d1', 'get'], `Get database metadata`)
    .arg('databaseUuid', 'string', 'Database identifier')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#get')
    ;

export const DROP_COMMAND = denoflareCliCommand(['d1', 'drop'], `Drop a database`)
    .arg('databaseName', 'string', 'Name of the database to drop')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#drop')
    ;

export const CREATE_COMMAND = denoflareCliCommand(['d1', 'create'], `Create a database`)
    .arg('databaseName', 'string', 'Name of the database to create')
    .option('location', 'enum', `Hint for the database's primary location`, ...Object.entries({ weur: 'Western Europe', eeur: 'Eastern Europe', apac: 'Asia Pacific', wnam: 'Western North America', enam: 'Eastern North America' }).map(v => ({ value: v[0], description: v[1] })))
    .option('experimentalBackend', 'boolean', 'Use the new experimental database backend')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#create')
    ;

export const QUERY_COMMAND = denoflareCliCommand(['d1', 'query'], `Query a database`)
    .arg('databaseName', 'string', 'Name of the database to query')
    .option('sql', 'string', 'SQL query to execute')
    .option('param', 'strings', 'Ordinal parameters for the query', { hint: 'value' })
    .option('raw', 'boolean', 'Returns results as arrays instead of objects, more efficient')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#query')
    ;

export const EXPORT_COMMAND = denoflareCliCommand(['d1', 'export'], `Returns a URL where the SQL contents of your D1 can be downloaded`)
    .arg('databaseName', 'string', 'Name of the database to export')
    .option('poll', 'boolean', 'Incremental polling for progress, useful for larger exports')
    .option('bookmark', 'string', 'Resume polling as of a returned last bookmark')
    .option('noData', 'boolean', 'Export only the table definitions, not their contents')
    .option('noSchema', 'boolean', 'Export only each table\'s contents, not its definition')
    .option('table', 'strings', 'Filter the export to just one or more tables')
    .option('file', 'string', 'Local file path at which to save the export sql file')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#export')
    ;

export const IMPORT_COMMAND = denoflareCliCommand(['d1', 'import'], `Imports SQL into a database`)
    .arg('databaseName', 'string', 'Name of the database to export')
    .option('poll', 'boolean', 'Incremental polling for progress, useful for larger exports')
    .option('file', 'required-string', 'Local sql file to import')
    .subcommandGroup()
    .option('tsvTable', 'string', 'TSV input mode: specifies the table name')
    .option('tsvPk', 'string', 'TSV input mode: name of the primary key column')
    .option('tsvNoRowid', 'boolean', 'TSV input mode: create the table without rowid')
    .option('tsvMaxRows', 'integer', 'TSV input mode: only import the first n data rows (not counting the header)')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#import')
    ;

export const BACKUP_COMMAND = denoflareCliCommand(['d1', 'backup'], `Backup a database`)
    .arg('databaseName', 'string', 'Name of the database to backup')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#backup')
    ;

export const LIST_BACKUPS_COMMAND = denoflareCliCommand(['d1', 'list-backups'], `List all backups for a database`)
    .arg('databaseName', 'string', 'Name of the database')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#list-backups')
    ;

export const RESTORE_COMMAND = denoflareCliCommand(['d1', 'restore'], `Restore a database from a previous backup`)
    .arg('databaseName', 'string', 'Name of the database to backup')
    .option('backupId', 'required-string', 'Uuid of the backup to restore')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#restore')
    ;

export const DOWNLOAD_COMMAND = denoflareCliCommand(['d1', 'download'], `Download a database as a sqlite3 db file`)
    .arg('databaseName', 'string', 'Name of the database to download')
    .option('file', 'required-string', 'Local file path at which to save the sqlite db file')
    .option('backupId', 'string', 'Uuid of the backup to download (default: take a new backup and download that)')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#download')
    ;

export const D1_COMMAND = denoflareCliCommand('d1', 'Manage and query your Cloudflare D1 databases')
    .subcommand(LIST_COMMAND, list)
    .subcommand(GET_COMMAND, get)
    .subcommand(DROP_COMMAND, drop)
    .subcommand(CREATE_COMMAND, create)
    .subcommand(QUERY_COMMAND, query)
    .subcommand(EXPORT_COMMAND, export_)
    .subcommand(IMPORT_COMMAND, import_)
    .subcommandGroup()
    .subcommand(BACKUP_COMMAND, backup)
    .subcommand(RESTORE_COMMAND, restore)
    .subcommand(DOWNLOAD_COMMAND, download)
    .subcommand(LIST_BACKUPS_COMMAND, listBackups)

    .docsLink('/cli/d1')
    ;

export async function d1(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    await D1_COMMAND.routeSubcommand(args, options);
}

//

async function list(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (LIST_COMMAND.dumpHelp(args, options)) return;

    const { verbose, name } = LIST_COMMAND.parse(args, options);
    if (verbose) CloudflareApi.DEBUG = true;
    const { accountId, apiToken } = await resolveProfile(await loadConfig(options), options);

    const dbs = await listD1Databases({ accountId, apiToken, name });
    console.log(dbs);
}

async function get(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (GET_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseUuid } = GET_COMMAND.parse(args, options);
    if (verbose) CloudflareApi.DEBUG = true;
    const { accountId, apiToken } = await resolveProfile(await loadConfig(options), options);

    const db = await getD1DatabaseMetadata({ accountId, apiToken, databaseUuid });
    console.log(db);
}

async function drop(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (DROP_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseName } = DROP_COMMAND.parse(args, options);
    const { databaseUuid, accountId, apiToken } = await common(databaseName, verbose, options);

    await deleteD1Database({ accountId, apiToken, databaseUuid });
}

async function create(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (CREATE_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseName, location, experimentalBackend } = CREATE_COMMAND.parse(args, options);
    if (verbose) CloudflareApi.DEBUG = true;
    const { accountId, apiToken } = await resolveProfile(await loadConfig(options), options);

    const db = await createD1Database({ accountId, apiToken, databaseName, location, experimentalBackend });
    console.log(db);
}

async function query(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (QUERY_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseName, sql, param, raw } = QUERY_COMMAND.parse(args, options);
    if (!sql) throw new Error(`Provide a query with --sql`);

    const { databaseUuid, accountId, apiToken } = await common(databaseName, verbose, options);

    const queryResults = raw ? await rawQueryD1Database({ accountId, apiToken, databaseUuid, sql, params: param }) : await queryD1Database({ accountId, apiToken, databaseUuid, sql, params: param });
    console.log(JSON.stringify(queryResults, undefined, 2));
}

async function export_(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (EXPORT_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseName, poll, bookmark, noData, noSchema, table = [], file } = EXPORT_COMMAND.parse(args, options);

    const { databaseUuid, accountId, apiToken } = await common(databaseName, verbose, options);
    const outputFormat = (bookmark || poll) ? 'polling' : undefined;
    const currentBookmark = bookmark;
    const dumpOptions: D1DumpOptions | undefined = noData || noSchema || table.length > 0 ? { no_data: noData, no_schema: noSchema, tables: table.length > 0 ? table : undefined } : undefined;
    const result = await exportD1Database({ accountId, apiToken, databaseUuid, outputFormat, currentBookmark, dumpOptions });
    console.log(JSON.stringify(result, undefined, 2));

    const output = 'signed_url' in result ? result : result.result;
    if (output?.signed_url && file) {
        console.log(`Saving to ${file}...`);
        const start = Date.now();
        const res = await fetch(output.signed_url);
        if (res.status !== 200) throw new Error(`Export result had unexpected status: ${res.status}`);
        if (!res.body) throw new Error(`Export result had no body`);
        await Deno.writeFile(file, res.body);
        console.log(`...saved in ${Date.now() - start}ms`);
    } 
}

async function generateSqlFromTsvIfNecessary(file: string, { tsvTable, tsvPk, tsvNoRowid, tsvMaxRows }: { tsvTable: string | undefined, tsvPk: string | undefined, tsvNoRowid: boolean | undefined, tsvMaxRows: number | undefined }): Promise<string | undefined> {
    if (tsvTable === undefined) return undefined;
    const stream = await Deno.open(file);
    type Column = { name: string, type: 'text' | 'integer' };
    const columns: Column[] = [];
    const lines: string[] = [];
    for await (const line of stream.readable.pipeThrough(new TextDecoderStream()).pipeThrough(new TextLineStream())) {
        const tokens = line.split('\t');
        if (columns.length === 0) {
            columns.push(...tokens.map(v => ({ name: v, type: 'text' } as Column)));
            continue;
        }
        if (tokens.length !== columns.length) throw new Error(`Bad line: ${line}`);
        if (lines.length === 0) {
            tokens.forEach((v, i) => {
                if (/^\d{1,18}$/.test(v)) columns[i].type = 'integer';
            });
            const ddl = `CREATE TABLE IF NOT EXISTS "${tsvTable}" (${[...columns.map(v => `"${v.name}" ${v.type}`), ...(tsvPk ? [ `PRIMARY KEY("${tsvPk}")` ] : [])].join(', ')})${tsvNoRowid ? ` without rowid` : ''};`;
            lines.push(ddl);
        }
        if (tsvMaxRows !== undefined && lines.length >= (tsvMaxRows + 1)) break;
        const dml = `INSERT INTO "${tsvTable}" VALUES (${tokens.map((v, i) => `${i > 0 ? ',' : ''}${v === '' ? 'NULL' : columns[i].type === 'integer' ? v : `'${v.replaceAll(`'`, '\\\'')}'`}`).join('')});`;
        lines.push(dml);
    }
    return lines.join('\n');
}

async function import_(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (IMPORT_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseName, file, tsvPk, tsvTable, tsvNoRowid, tsvMaxRows } = IMPORT_COMMAND.parse(args, options);
    if ((tsvPk !== undefined || tsvNoRowid !== undefined || tsvMaxRows !== undefined) && !tsvTable) throw new Error('--tsv-table option is required in TSV input mode');

    const { databaseUuid, accountId, apiToken } = await common(databaseName, verbose, options);
  
    const sql = await generateSqlFromTsvIfNecessary(file, { tsvPk, tsvTable, tsvNoRowid, tsvMaxRows }) ?? await Deno.readTextFile(file);
    const etag = (await computeMd5(Bytes.ofUtf8(sql))).hex();

    const filename = await (async () => {
        const action: D1ImportAction = {
            action: 'init',
            etag,
        };

        console.log('creating import...');
        const result = await importIntoD1Database({ accountId, apiToken, databaseUuid, action });
        console.log(JSON.stringify(result, undefined, 2));

        const { success, filename, upload_url } = result;
        if (!success) throw new Error(`Import failed`);
        if (typeof filename !== 'string') throw new Error(`Unexpected filename: ${filename}`);
        if (typeof upload_url !== 'string' || !isValidUrl(upload_url)) throw new Error(`Unexpected upload_url: ${upload_url}`);

        console.log('uploading...');
        const res = await fetch(upload_url, { method: 'PUT', body: sql });
        if (res.status !== 200) {
            console.log(res);
            throw new Error(`Unexpected upload status: ${res.status}`);
        }
        return filename;
    })();

    await (async () => {
        console.log('signal ingest...');
        const action: D1ImportAction = {
            action: 'ingest',
            etag,
            filename,
        };

        const result = await importIntoD1Database({ accountId, apiToken, databaseUuid, action });
        console.log(JSON.stringify(result, undefined, 2));

    })();
}


// alpha only: deprecated
async function backup(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (BACKUP_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseName } = BACKUP_COMMAND.parse(args, options);
    const { databaseUuid, accountId, apiToken } = await common(databaseName, verbose, options);

    const start = Date.now();
    const backup = await createD1Backup({ accountId, apiToken, databaseUuid });
    console.log(`Backup ${backup.id} (${Bytes.formatSize(backup.file_size)}) took ${Date.now() - start}ms`);
}

// alpha only: deprecated
async function listBackups(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (BACKUP_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseName } = BACKUP_COMMAND.parse(args, options);
    const { databaseUuid, accountId, apiToken } = await common(databaseName, verbose, options);

    const backups = await listD1Backups({ accountId, apiToken, databaseUuid });
    const sorted = [...backups].sort((a, b) =>  a.created_at.localeCompare(b.created_at));
    let prevDay: string | undefined;
    for (const backup of sorted) {
        checkEqual('backup.database_id', backup.database_id, databaseUuid);
        const time = backup.created_at.substring(0, `2022-07-02T00:37:22`.length);
        const day = time.substring(0, `2022-07-02`.length);
        if (prevDay && day !== prevDay) console.log();
        console.log(`${backup.id} ${time} state=${backup.state} tables=${backup.num_tables} size=${Bytes.formatSize(backup.file_size)}`);
        prevDay = day;
    }
    console.log(`${backups.length} backups`)
}

// alpha only: deprecated
async function restore(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (RESTORE_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseName, backupId: backupUuid } = RESTORE_COMMAND.parse(args, options);

    const { databaseUuid, accountId, apiToken } = await common(databaseName, verbose, options);

    const start = Date.now();
    await restoreD1Backup({ accountId, apiToken, databaseUuid, backupUuid });
    console.log(`Restore of backup ${backupUuid} took ${Date.now() - start}ms`);
}

// alpha only: deprecated
async function download(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (DOWNLOAD_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseName, backupId, file } = DOWNLOAD_COMMAND.parse(args, options);

    const { databaseUuid, accountId, apiToken } = await common(databaseName, verbose, options);

    const backupUuid = backupId ?? await (async () => {
        const start = Date.now();
        const backup = await createD1Backup({ accountId, apiToken, databaseUuid });
        console.log(`Backup ${backup.id} (${Bytes.formatSize(backup.file_size)}) took ${Date.now() - start}ms`);
        return backup.id;
    })();
    const start = Date.now();
    const bytes = await downloadD1Backup({ accountId, apiToken, databaseUuid, backupUuid });
    console.log(`Download of backup ${backupUuid} (${Bytes.formatSize(bytes.length)}) took ${Date.now() - start}ms`);

    await Deno.writeFile(file, bytes);
    console.log(`Saved to ${normalize(join(Deno.cwd(), file))}`);
}

//

async function common(databaseName: string, verbose: boolean, options: Record<string, unknown>): Promise<{ databaseUuid: string, accountId: string, apiToken: string }> {
    if (verbose) CloudflareApi.DEBUG = true;
    const { accountId, apiToken } = await resolveProfile(await loadConfig(options), options);
    if (isValidUuid(databaseName)) return { databaseUuid: databaseName, accountId, apiToken };
    
    const database = (await listD1Databases({ accountId, apiToken })).find(v => v.name === databaseName);
    if (!database) throw new Error(`Database not found: ${databaseName}`);
    const { uuid: databaseUuid } = database;

    return { databaseUuid, accountId, apiToken };
}

function isValidUuid(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(str);
}

