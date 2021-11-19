import { Profile } from '../common/config.ts';
import { CLI_VERSION } from './cli_version.ts';
import { loadConfig, resolveProfile } from './config_loader.ts';
import { CfGqlClient } from '../common/analytics/cfgql_client.ts';
import { computeDurableObjectsCostsTable } from '../common/analytics/durable_objects_costs.ts';

export async function analytics(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    const firstArg = args[0];
    if (options.help || typeof firstArg !== 'string' ) {
        dumpHelp();
        return;
    }
    if (firstArg === 'do' || firstArg === 'durable-objects') {
        const config = await loadConfig(options);
        const profile = await resolveProfile(config, options);
        const namespaceId = typeof args[1] === 'string' ? args[1] : undefined;
        await dumpDurableObjects(profile, namespaceId);
    } else {
        dumpHelp();
    }
}

//

function dumpHelp() {
    const lines = [
        `denoflare-analytics ${CLI_VERSION}`,
        'Dump stats via the Cloudflare GraphQL Analytics API',
        '',
        'USAGE:',
        '    denoflare analytics [FLAGS] [OPTIONS] [--]',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '        --watch       Re-upload the worker script when local changes are detected',
        '',
        'OPTIONS:',
        '        --profile <name>     Name of profile to load from config (default: only profile or default profile in config)',
        '        --config <path>      Path to config file (default: .denoflare in cwd or parents)',
        '',
        'ARGS:',
    ];
    for (const line of lines) {
        console.log(line);
    }
}

async function dumpDurableObjects(profile: Profile, namespaceId: string | undefined) {
    const client = new CfGqlClient(profile);
    // CfGqlClient.DEBUG = true;

    const tableResult = await computeDurableObjectsCostsTable(client, { lookbackDays: 28 });
    const tableRows: (string | number)[][] = [];
    tableRows.push([
        'date',
        'req',
        '',
        'ws.max',
        'ws.in',
        'ws.out',
        '',
        'subreq',
        '',
        'active.gbs',
        '',
        'reads',
        '',
        'writes',
        '',
        'deletes',
        '',
        'storage',
        '',
        'total.cost',
    ]);

    const table = namespaceId ? tableResult.namespaceTables[namespaceId] : tableResult.accountTable;
    for (const row of table.rows) {
        const tableRow = [
            row.date,
            row.sumRequests,
            `$${row.requestsCost.toFixed(2)}`,
            row.maxActiveWebsocketConnections,
            row.sumInboundWebsocketMsgCount,
            row.sumOutboundWebsocketMsgCount,
            `$${row.websocketsCost.toFixed(2)}`,
            row.sumSubrequests,
            `$${row.subrequestsCost.toFixed(2)}`,
            `${row.activeGbSeconds.toFixed(2)}gb-s`, 
            `$${row.activeCost.toFixed(2)}`, 
            row.sumStorageReadUnits, 
            `$${row.readUnitsCost.toFixed(2)}`,
            row.sumStorageWriteUnits,
            `$${row.writeUnitsCost.toFixed(2)}`,
            row.sumStorageDeletes,
            `$${row.deletesCost.toFixed(2)}`,
            row.storageGb ? `${row.storageGb?.toFixed(2)}gb` : '?',
            row.storageCost ? `$${row.storageCost?.toFixed(2)}` : '',
            `$${row.totalCost.toFixed(2)}`,
        ];
        tableRows.push(tableRow);
    }

    if (table.estimated30DayRow) {
        tableRows.push(Array(20).fill(''));
        tableRows.push([
            'est 30-day', 
            '', 
            `$${table.estimated30DayRow.requestsCost.toFixed(2)}`, 
            '', 
            '', 
            '', 
            `$${table.estimated30DayRow.websocketsCost.toFixed(2)}`, 
            '', 
            `$${table.estimated30DayRow.subrequestsCost.toFixed(2)}`, 
            '', 
            `$${table.estimated30DayRow.activeCost.toFixed(2)}`, 
            '', 
            `$${table.estimated30DayRow.readUnitsCost.toFixed(2)}`, 
            '', 
            `$${table.estimated30DayRow.writeUnitsCost.toFixed(2)}`, 
            '', 
            `$${table.estimated30DayRow.deletesCost.toFixed(2)}`,
            '',
            table.estimated30DayRow.storageCost ? `$${table.estimated30DayRow.storageCost.toFixed(2)}` : '',
            `$${table.estimated30DayRow.totalCost.toFixed(2)}`
        ]);
        tableRows.push(Array(20).fill(''));
    }
    dumpTable(tableRows);

    const namespaceIds = [...Object.keys(tableResult.namespaceTables)];
    if (namespaceIds.length > 1 && !namespaceId) {
        console.log('\nper namespace:');
        for (const [ namespaceId, table ] of [...Object.entries(tableResult.namespaceTables)].sort((a, b) => (b[1].estimated30DayRow?.totalCost || 0) - (a[1].estimated30DayRow?.totalCost || 0))) {
            const estTotal = table.estimated30DayRow?.totalCost || 0;
            const pieces = [ `$${estTotal.toFixed(2)}`.padStart(7, ' '), namespaceId ];
            if (table.namespace?.script) pieces.push(table.namespace.script);
            if (table.namespace?.class) pieces.push(table.namespace.class);
            console.log(pieces.join(' '));
        }
    }

    console.log('');
    for (const [ name, { fetchMillis, cost, budget } ] of Object.entries(tableResult.gqlResultInfos)) {
        console.log(`${name}: fetchTime: ${fetchMillis}ms, cost: ${cost}, budget: ${budget} (${Math.round(budget / cost)} left of those)`);
    }
}

function dumpTable(rows: (string | number)[][]) {
    const sizes: number[] = [];
    for (const row of rows) {
        for (let i = 0; i < row.length; i++) {
            const size = `${row[i]}`.length;
            sizes[i] = typeof sizes[i] === 'number' ? Math.max(sizes[i], size) : size;
        }
    }
    for (const row of rows) {
        const pieces = [];
        for (let i = 0; i < row.length; i++) {
            const size = sizes[i];
            const val = `${row[i]}`;
            pieces.push(val.padStart(size, ' '));
        }
        console.log(pieces.join('  '));
    }
}

