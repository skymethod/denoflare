import { Profile } from '../common/config.ts';
import { commandOptionsForConfig, loadConfig, resolveProfile } from './config_loader.ts';
import { CfGqlClient } from '../common/analytics/cfgql_client.ts';
import { computeDurableObjectsCostsTable } from '../common/analytics/durable_objects_costs.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { dumpTable } from './cli_analytics.ts';
import { Bytes } from '../common/bytes.ts';
import { DurableObjectsNamespace } from '../common/cloudflare_api.ts';

export const ANALYTICS_DURABLE_OBJECTS_COMMAND = denoflareCliCommand(['analytics', 'durable-objects'], 'Dump durable objects stats via the Cloudflare GraphQL Analytics API')
    .option('namespaceId', 'string', 'Filter to single Durable Objects namespace id')
    .option('start', 'string', 'Start of the analysis range (inclusive)', { hint: 'yyyy-mm-dd' })
    .option('end', 'string', 'End of the analysis range (inclusive)', { hint: 'yyyy-mm-dd' })
    .option('budget', 'boolean', 'If set, dump GraphQL API request budget')
    .option('totals', 'boolean', 'If set, dump storage read/write unit and request/subrequest totals')
    .option('demo', 'boolean', '')
    .include(commandOptionsForConfig)
    .docsLink('/cli/analytics/durable-objects')
    ;
    
export async function analyticsDurableObjects(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (ANALYTICS_DURABLE_OBJECTS_COMMAND.dumpHelp(args, options)) return;

    const { namespaceId, start, end, budget: dumpBudget, totals: dumpTotals, demo } = ANALYTICS_DURABLE_OBJECTS_COMMAND.parse(args, options);
    const config = await loadConfig(options);
    const profile = await resolveProfile(config, options);
    const range = start && end ? { start, end } : start && !end ? { start, end: new Date().toISOString().substring(0, 10) } : undefined;
    await dumpDurableObjects(profile, namespaceId, { dumpBudget, dumpTotals, range, demo });
}

//

async function dumpDurableObjects(profile: Profile, namespaceId: string | undefined, opts: { dumpBudget?: boolean, dumpTotals?: boolean, range?: { start: string, end: string }, demo?: boolean }) {
    const { dumpBudget, dumpTotals, range, demo } = opts;
    const client = new CfGqlClient(profile);
    // CfGqlClient.DEBUG = true;

    const tableResult = await computeDurableObjectsCostsTable(client, range || { lookbackDays: 28 });
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
    let sumStorageReadUnits = 0;
    let sumStorageWriteUnits = 0;
    let sumRequests = 0;
    let sumSubrequests = 0;
    for (const row of table.rows) {
        sumStorageReadUnits += row.sumStorageReadUnits;
        sumStorageWriteUnits += row.sumStorageWriteUnits;
        sumRequests += row.sumRequests;
        sumSubrequests += row.sumSubrequests;
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
    }
    if (table.estimated30DayRowMinusFree) {
        tableRows.push([
            'minus free', 
            '', 
            `$${table.estimated30DayRowMinusFree.requestsCost.toFixed(2)}`, 
            '', 
            '', 
            '', 
            `$${table.estimated30DayRowMinusFree.websocketsCost.toFixed(2)}`, 
            '', 
            `$${table.estimated30DayRowMinusFree.subrequestsCost.toFixed(2)}`, 
            '', 
            `$${table.estimated30DayRowMinusFree.activeCost.toFixed(2)}`, 
            '', 
            `$${table.estimated30DayRowMinusFree.readUnitsCost.toFixed(2)}`, 
            '', 
            `$${table.estimated30DayRowMinusFree.writeUnitsCost.toFixed(2)}`, 
            '', 
            `$${table.estimated30DayRowMinusFree.deletesCost.toFixed(2)}`,
            '',
            table.estimated30DayRowMinusFree.storageCost ? `$${table.estimated30DayRowMinusFree.storageCost.toFixed(2)}` : '',
            `$${table.estimated30DayRowMinusFree.totalCost.toFixed(2)}`
        ]);
    }
    dumpTable(tableRows);

    const namespaceIds = [...Object.keys(tableResult.namespaceTables)];
    if (namespaceIds.length > 1 && !namespaceId) {
        console.log('\nper namespace:');
        for (const [ namespaceId, table ] of [...Object.entries(tableResult.namespaceTables)].sort((a, b) => (b[1].estimated30DayRow?.totalCost || 0) - (a[1].estimated30DayRow?.totalCost || 0))) {
            const estTotal = table.estimated30DayRow?.totalCost || 0;
            const demoNamespace = demo ? getDemoNamespace(Object.keys(tableResult.namespaceTables).indexOf(namespaceId)) : undefined;
            const pieces = [ `$${estTotal.toFixed(2)}`.padStart(7, ' '), demoNamespace?.id ?? namespaceId ];
            const namespace = demoNamespace ?? table.namespace;
            if (namespace?.script) pieces.push(namespace.script);
            if (namespace?.class) pieces.push(namespace.class);
            console.log(pieces.join(' '));
        }
    }

    if (dumpBudget) {
        console.log('\ngraphql budget:');
        for (const [ name, { fetchMillis, cost, budget } ] of Object.entries(tableResult.gqlResultInfos)) {
            console.log(`${name}: fetchTime: ${fetchMillis}ms, cost: ${cost}, budget: ${budget} (${Math.round(budget / cost)} left of those)`);
        }
    }

    if (dumpTotals) {
        const width = Math.max(...[sumStorageReadUnits, sumStorageWriteUnits, sumRequests, sumSubrequests].map(v => v.toString().length));
        console.log('\ntotals:');
        console.log(`  storage read units:  ${sumStorageReadUnits.toString().padStart(width)}`);
        console.log(`  storage write units: ${sumStorageWriteUnits.toString().padStart(width)}`);
        console.log(`  requests:            ${sumRequests.toString().padStart(width)}`);
        console.log(`  subrequests:         ${sumSubrequests.toString().padStart(width)}`);
    }
}

const demoNamespaces: DurableObjectsNamespace[] = [];

function getDemoNamespace(index: number): DurableObjectsNamespace {
    if (demoNamespaces.length === 0) {
        [ 'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa' ].forEach((name, i) => {
            const id = new Bytes(crypto.getRandomValues(new Uint8Array(16))).hex();
            demoNamespaces.push({ id, name: `name${i + 1}`, script: `script${i + 1}`, class: `${name.substring(0, 1).toUpperCase()}${name.substring(1)}DO`, use_sqlite: false });
        });
    }
    return demoNamespaces[index % demoNamespaces.length];
}
