import { Bytes } from '../common/bytes.ts';
import { isValidUrl, isValidUuid } from '../common/check.ts';
import { CloudflareApi, createD1Database, D1DumpOptions, D1ImportAction, D1ImportResult, deleteD1Database, exportD1Database, getD1DatabaseMetadata, getD1TimeTravelBookmark, importIntoD1Database, listD1Databases, queryD1Database, rawQueryD1Database, restoreD1TimeTravel } from '../common/cloudflare_api.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForConfig, loadConfig, resolveProfile } from './config_loader.ts';
import { TextLineStream } from './deps_cli.ts';
import { computeMd5 } from './wasm_crypto.ts';
// only import if used
// import { DB } from 'https://deno.land/x/sqlite@v3.8/mod.ts';

export const LIST_COMMAND = denoflareCliCommand(['d1', 'list'], `List databases`)
    .option('name', 'string', 'A database name to search for')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#list')
    ;

export const GET_COMMAND = denoflareCliCommand(['d1', 'get'], `Get database metadata`)
    .arg('databaseName', 'string', 'Name of the database')
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

export const EXPORT_COMMAND = denoflareCliCommand(['d1', 'export'], `Returns a signed url to the sql contents of a database`)
    .arg('databaseName', 'string', 'Name of the database to export')
    .option('poll', 'boolean', 'Incremental polling for progress, useful for larger exports')
    .option('bookmark', 'string', 'Resume polling as of a returned last bookmark')
    .option('noData', 'boolean', 'Export only the table definitions, not their contents')
    .option('noSchema', 'boolean', 'Export only each table\'s contents, not its definition')
    .option('table', 'strings', 'Filter the export to just one or more tables')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#export')
    ;

export const EXPORT_SQL_COMMAND = denoflareCliCommand(['d1', 'export-sql'], `Downloads a database as a SQL file`)
    .arg('databaseName', 'string', 'Name of the database to export')
    .option('file', 'required-string', 'Local file path at which to save the export sql file')
    .option('noData', 'boolean', 'Export only the table definitions, not their contents')
    .option('noSchema', 'boolean', 'Export only each table\'s contents, not its definition')
    .option('table', 'strings', 'Filter the export to just one or more tables')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#export-sql')
    ;

export const EXPORT_DB_COMMAND = denoflareCliCommand(['d1', 'export-db'], `Downloads a database as a sqlite3 db file`)
    .arg('databaseName', 'string', 'Name of the database to export')
    .option('file', 'required-string', 'Local file path at which to save the export sqlite3 db file')
    .option('noData', 'boolean', 'Export only the table definitions, not their contents')
    .option('noSchema', 'boolean', 'Export only each table\'s contents, not its definition')
    .option('table', 'strings', 'Filter the export to just one or more tables')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#export-db')
    ;

export const IMPORT_COMMAND = denoflareCliCommand(['d1', 'import'], `Imports SQL into a database`)
    .arg('databaseName', 'string', 'Name of the database to import into')
    .option('file', 'required-string', 'Local sql file to import')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#import')
    ;

export const IMPORT_TSV_COMMAND = denoflareCliCommand(['d1', 'import-tsv'], `Imports TSV data into a database`)
    .arg('databaseName', 'string', 'Name of the database to import into')
    .option('file', 'required-string', 'Local TSV file to import')
    .option('table', 'required-string', 'D1 table name')
    .option('pk', 'string', 'Name of the primary key column')
    .option('noRowid', 'boolean', 'Create the table without rowid')
    .option('maxRows', 'integer', 'Only import the first n data rows (not counting the header)')
    .option('skipRows', 'integer', 'Skip the first n data rows (not counting the header)')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#import-tsv')
    ;

export const TIME_TRAVEL_BOOKMARK_COMMAND = denoflareCliCommand(['d1', 'time-travel-bookmark'], `Obtain a time travel bookmark for a database`)
    .arg('databaseName', 'string', 'Name of the database')
    .option('timestamp', 'string', 'ISO time of the database state')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#time-travel-bookmark')
    ;

export const TIME_TRAVEL_RESTORE_COMMAND = denoflareCliCommand(['d1', 'time-travel-restore'], `Restore a database to a specific timestamp or bookmark`)
    .arg('databaseName', 'string', 'Name of the database')
    .option('timestamp', 'string', 'ISO time of the database state')
    .option('bookmark', 'string', 'A specific bookmark')
    .include(commandOptionsForConfig)
    .docsLink('/cli/d1#time-travel-restore')
    ;

export const D1_COMMAND = denoflareCliCommand('d1', 'Manage and query your Cloudflare D1 databases')
    .subcommand(LIST_COMMAND, list)
    .subcommand(GET_COMMAND, get)
    .subcommand(DROP_COMMAND, drop)
    .subcommand(CREATE_COMMAND, create)
    .subcommand(QUERY_COMMAND, query)
    .subcommandGroup()
    .subcommand(EXPORT_COMMAND, export_)
    .subcommand(EXPORT_SQL_COMMAND, exportSql)
    .subcommand(EXPORT_DB_COMMAND, exportDb)
    .subcommand(IMPORT_COMMAND, import_)
    .subcommand(IMPORT_TSV_COMMAND, importTsv)
    .subcommandGroup()
    .subcommand(TIME_TRAVEL_BOOKMARK_COMMAND, timeTravelBookmark)
    .subcommand(TIME_TRAVEL_RESTORE_COMMAND, timeTravelRestore)

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

    const { verbose, databaseName } = GET_COMMAND.parse(args, options);
    const { databaseUuid, accountId, apiToken } = await common(databaseName, verbose, options);

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

    const { verbose, databaseName, location } = CREATE_COMMAND.parse(args, options);
    if (verbose) CloudflareApi.DEBUG = true;
    const { accountId, apiToken } = await resolveProfile(await loadConfig(options), options);

    const db = await createD1Database({ accountId, apiToken, databaseName, location });
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

    const { verbose, databaseName, poll, bookmark, noData, noSchema, table = [] } = EXPORT_COMMAND.parse(args, options);

    const { databaseUuid, accountId, apiToken } = await common(databaseName, verbose, options);
    const outputFormat = (bookmark || poll) ? 'polling' : undefined;
    const currentBookmark = bookmark;
    const dumpOptions: D1DumpOptions | undefined = noData || noSchema || table.length > 0 ? { no_data: noData, no_schema: noSchema, tables: table.length > 0 ? table : undefined } : undefined;
    const result = await exportD1Database({ accountId, apiToken, databaseUuid, outputFormat, currentBookmark, dumpOptions });
    console.log(JSON.stringify(result, undefined, 2));
}

async function exportSql(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (EXPORT_SQL_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseName, noData, noSchema, table = [], file } = EXPORT_SQL_COMMAND.parse(args, options);

    await commonExportSql({ databaseName, verbose, options, noData, noSchema, table, file });
}

async function commonExportSql({ databaseName, verbose, options, noData, noSchema, table, file }: { databaseName: string, verbose: boolean, options: Record<string, unknown>, noData: boolean | undefined, noSchema: boolean | undefined, table: string[], file: string }) {
    const { databaseUuid, accountId, apiToken } = await common(databaseName, verbose, options);
    const dumpOptions: D1DumpOptions | undefined = noData || noSchema || table.length > 0 ? { no_data: noData, no_schema: noSchema, tables: table.length > 0 ? table : undefined } : undefined;
    let currentBookmark = undefined;
    let signedUrl: string | undefined;
    console.log(`Exporting...`);
    let start = Date.now();
    while (true) {
        const result = await exportD1Database({ accountId, apiToken, databaseUuid, outputFormat: 'polling', currentBookmark, dumpOptions });
        if ('signed_url' in result) {
            signedUrl = result.signed_url;
            break;
        }
        const { messages, at_bookmark, result: finalResult, status, error } = result;
        for (const message of messages ?? []) {
            console.log(message);
        }
        if (finalResult && typeof finalResult.signed_url === 'string') {
            signedUrl = finalResult.signed_url;
            break;
        }
        if (status === 'error') {
            throw new Error(`Failed: ${error}`);
        }
        if (typeof at_bookmark === 'string') {
            currentBookmark = at_bookmark
        } else {
            throw new Error(`Can't continue polling without a bookmark`);
        }
    }
    if (!signedUrl) throw new Error(`Did not produce a signed url!`);
    console.log(`...exported in ${Date.now() - start}ms`);

    console.log(`Saving to ${file}...`);
    start = Date.now();
    const res = await fetch(signedUrl);
    if (res.status !== 200) throw new Error(`Export result had unexpected status: ${res.status}`);
    if (!res.body) throw new Error(`Export result had no body`);
    await Deno.writeFile(file, res.body);
    console.log(`...saved in ${Date.now() - start}ms`);
}

async function exportDb(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (EXPORT_DB_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseName, noData, noSchema, table = [], file } = EXPORT_DB_COMMAND.parse(args, options);

    try { await Deno.remove(file); } catch (e) { if (!(e instanceof Deno.errors.NotFound )) throw e; }

    const { DB } = await import('https://deno.land/x/sqlite@v3.8/mod.ts' + '');

    const sqlFile = `${file}.sql`;
    await commonExportSql({ databaseName, verbose, options, noData, noSchema, table, file: sqlFile });

    const start = Date.now();
    const lineStream = (await Deno.open(sqlFile)).readable
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TextLineStream());
    
    console.log(`Creating ${file}...`);
    
    const db = new DB(file);
    for await (const line of lineStream) {
        db.execute(line);
    }
    db.close();
    console.log(`...created sqlite db in ${Date.now() - start}ms`);
    await Deno.remove(sqlFile);
}

async function importTsv(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (IMPORT_TSV_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseName, file, pk, table, noRowid, maxRows, skipRows } = IMPORT_TSV_COMMAND.parse(args, options);

    const { databaseUuid, accountId, apiToken } = await common(databaseName, verbose, options);

    const generateSqlFromTsv = async (): Promise<string> => {
        const stream = await Deno.open(file);
        type Column = { name: string, type: 'text' | 'integer' };
        const columns: Column[] = [];
        const lines: string[] = [];
        let skipRemaining = skipRows ?? 0;
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
                const ddl = `CREATE TABLE IF NOT EXISTS "${table}" (${[...columns.map(v => `"${v.name}" ${v.type}`), ...(pk ? [ `PRIMARY KEY("${pk}")` ] : [])].join(', ')})${noRowid ? ` without rowid` : ''};`;
                lines.push(ddl);
            }
            if (skipRemaining > 0) {
                skipRemaining--;
                continue;
            }
            if (maxRows !== undefined && lines.length >= (maxRows + 1)) break;
            const dml = `INSERT INTO "${table}" VALUES (${tokens.map((v, i) => `${i > 0 ? ',' : ''}${v === '' ? 'NULL' : columns[i].type === 'integer' ? v : `'${v.replaceAll(`'`, `''`)}'`}`).join('')});`;
            lines.push(dml);
        }
        return lines.join('\n');
    }

    const sql = await generateSqlFromTsv();
    await importCommon(sql, { verbose, accountId, apiToken, databaseUuid });
}

async function import_(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (IMPORT_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseName, file } = IMPORT_COMMAND.parse(args, options);

    const { databaseUuid, accountId, apiToken } = await common(databaseName, verbose, options);
  
    const sql = await Deno.readTextFile(file);
    await importCommon(sql, { verbose, accountId, apiToken, databaseUuid });
}

const costFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 });

async function importCommon(sql: string, { verbose, accountId, apiToken, databaseUuid }: { verbose: boolean, accountId: string, apiToken: string, databaseUuid: string }) {
    const etag = (await computeMd5(Bytes.ofUtf8(sql))).hex();

    const logResult = (result: D1ImportResult) => {
        const { messages, status, result: finalResult } = result;
        if (verbose) {
            console.log(JSON.stringify(result, undefined, 2));
        } else {
            messages?.forEach(v => console.log(v));
            if (finalResult?.meta && status === 'complete') console.log(finalResult.meta);
        }
        if (finalResult && status === 'complete') {
            const { rows_read, rows_written, size_after } = finalResult.meta;
            // $0.001 / million rows read
            // $1.00 / million rows written
            const importCost = rows_read / 1_000_000 * 0.001 + rows_written / 1_000_000;
            console.log(`import cost: $${costFormat.format(importCost)}`);

            // $0.75 / GB-mo
            const monthlyStorageCost = size_after / 1_000_000_000 * 0.75;
            console.log(`monthly storage cost: $${costFormat.format(monthlyStorageCost)}`);
        }
    }

    const filename = await (async () => {
        const action: D1ImportAction = {
            action: 'init',
            etag,
        };

        console.log('initializing import...');
        const result = await importIntoD1Database({ accountId, apiToken, databaseUuid, action });
        logResult(result);

        const { success, filename, upload_url } = result;
        if (!success) throw new Error(`Import init failed`);
        if (typeof filename !== 'string') throw new Error(`Unexpected filename: ${filename}`);
        if (typeof upload_url !== 'string' || !isValidUrl(upload_url)) throw new Error(`Unexpected upload_url: ${upload_url}`);

        console.log('uploading...');
        const res = await fetch(upload_url, { method: 'PUT', body: sql });
        if (res.status !== 200) throw new Error(`Unexpected upload status: ${res.status}`);
        const resEtag = res.headers.get('etag') ?? undefined;
        if (resEtag !== `"${etag}"`) throw new Error(`Unexpected etag: ${resEtag}`);
        return filename;
    })();

    let { status, at_bookmark } = await (async () => {
        console.log('signal ingest...');
        const action: D1ImportAction = {
            action: 'ingest',
            etag,
            filename,
        };

        const result = await importIntoD1Database({ accountId, apiToken, databaseUuid, action });
        logResult(result);
        const { success, status, at_bookmark } = result;
        if (!success) throw new Error(`Import ingest failed`);
        if (status !== 'active' && status !== 'complete') throw new Error(`Unsupported status: ${status}`);
        if (typeof at_bookmark !== 'string') throw new Error(`Unexpected at_bookmark: ${JSON.stringify(at_bookmark)}`);
        return { at_bookmark, status };
    })();

    while (status !== 'complete') {
        console.log('poll for completion...');
        const action: D1ImportAction = {
            action: 'poll',
            current_bookmark: at_bookmark,
        };

        const result = await importIntoD1Database({ accountId, apiToken, databaseUuid, action });
        logResult(result);
        const { success } = result;
        if (!success) throw new Error(`Import ingest failed`);
        status = result.status;
        if (typeof result.at_bookmark !== 'string') throw new Error(`Unexpected at_bookmark: ${JSON.stringify(result.at_bookmark)}`);
        at_bookmark = result.at_bookmark;
        if (status !== 'active' && status !== 'complete') throw new Error(`Unsupported status: ${status}`);
    }
}

async function timeTravelBookmark(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (TIME_TRAVEL_BOOKMARK_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseName, timestamp } = TIME_TRAVEL_BOOKMARK_COMMAND.parse(args, options);

    const { databaseUuid, accountId, apiToken } = await common(databaseName, verbose, options);

    const result = await getD1TimeTravelBookmark({ accountId, apiToken, databaseUuid, timestamp });
    console.log(JSON.stringify(result, undefined, 2));
}

async function timeTravelRestore(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (TIME_TRAVEL_RESTORE_COMMAND.dumpHelp(args, options)) return;

    const { verbose, databaseName, timestamp, bookmark } = TIME_TRAVEL_RESTORE_COMMAND.parse(args, options);
    if (timestamp === undefined && bookmark === undefined) throw new Error(`Restore to either a 'timestamp' or 'bookmark'`);
    if (timestamp !== undefined && bookmark !== undefined) throw new Error(`You can specify 'timestamp' or 'bookmark', but not both`);

    const { databaseUuid, accountId, apiToken } = await common(databaseName, verbose, options);

    const result = await restoreD1TimeTravel({ accountId, apiToken, databaseUuid, bookmark, timestamp });
    console.log(JSON.stringify(result, undefined, 2));
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
