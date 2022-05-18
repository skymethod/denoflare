import { Profile } from '../common/config.ts';
import { commandOptionsForConfig, loadConfig, resolveProfile } from './config_loader.ts';
import { CfGqlClient } from '../common/analytics/cfgql_client.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { computeR2CostsTable } from '../common/analytics/r2_costs.ts';
import { dumpTable } from './cli_analytics.ts';

export const ANALYTICS_R2_COMMAND = denoflareCliCommand(['analytics', 'r2'], 'Dump R2 stats via the Cloudflare GraphQL Analytics API')
    .option('bucket', 'string', 'Filter to single R2 bucket', { hint: 'name' })
    .option('start', 'string', 'Start of the analysis range (inclusive)', { hint: 'yyyy-mm-dd' })
    .option('end', 'string', 'End of the analysis range (inclusive)', { hint: 'yyyy-mm-dd' })
    .option('budget', 'boolean', 'If set, dump GraphQL API request budget')
    .option('totals', 'boolean', 'If set, dump class a and class b operation totals')
    .include(commandOptionsForConfig)
    ;
    
export async function analyticsR2(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    if (ANALYTICS_R2_COMMAND.dumpHelp(args, options)) return;

    const { bucket: bucketName, start, end, budget: dumpBudget, totals: dumpTotals } = ANALYTICS_R2_COMMAND.parse(args, options);
    const config = await loadConfig(options);
    const profile = await resolveProfile(config, options);
    const range = start && end ? { start, end } : undefined;
    await dumpR2(profile, bucketName, { dumpBudget, dumpTotals, range });
}

//

async function dumpR2(profile: Profile, bucketName: string | undefined, opts: { dumpBudget?: boolean, dumpTotals?: boolean, range?: { start: string, end: string } }) {
    const { dumpBudget, dumpTotals, range } = opts;
    const client = new CfGqlClient(profile);
    // CfGqlClient.DEBUG = true;

    const tableResult = await computeR2CostsTable(client, range || { lookbackDays: 28 });
    const tableRows: (string | number)[][] = [];
    tableRows.push([
        'date',
        'class-a',
        '',
        'class-b',
        '',
        'storage',
        '',
        'total.cost',
    ]);

    const table = bucketName ? tableResult.bucketTables[bucketName] : tableResult.accountTable;
    let sumClassAOperations = 0;
    let sumClassBOperations = 0;
    for (const row of table.rows) {
        sumClassAOperations += row.classAOperations;
        sumClassBOperations += row.classBOperations;
        const tableRow = [
            row.date,
            row.classAOperations,
            `$${row.classAOperationsCost.toFixed(2)}`,
            row.classBOperations,
            `$${row.classBOperationsCost.toFixed(2)}`,
            row.storageGb ? `${row.storageGb?.toFixed(2)}gb` : '0',
            row.storageCost ? `$${row.storageCost?.toFixed(2)}` : '',
            `$${row.totalCost.toFixed(2)}`,
        ];
        tableRows.push(tableRow);
    }

    if (table.estimated30DayRow) {
        tableRows.push(Array(8).fill(''));
        tableRows.push([
            'est 30-day', 
            '', 
            `$${table.estimated30DayRow.classAOperationsCost.toFixed(2)}`,
            '', 
            `$${table.estimated30DayRow.classBOperationsCost.toFixed(2)}`,
            '',
            table.estimated30DayRow.storageCost ? `$${table.estimated30DayRow.storageCost.toFixed(2)}` : '',
            `$${table.estimated30DayRow.totalCost.toFixed(2)}`
        ]);
    }
    if (table.estimated30DayRowMinusFree) {
        tableRows.push([
            'minus free', 
            '', 
            `$${table.estimated30DayRowMinusFree.classAOperationsCost.toFixed(2)}`,
            '', 
            `$${table.estimated30DayRowMinusFree.classBOperationsCost.toFixed(2)}`,
            '',
            table.estimated30DayRowMinusFree.storageCost ? `$${table.estimated30DayRowMinusFree.storageCost.toFixed(2)}` : '',
            `$${table.estimated30DayRowMinusFree.totalCost.toFixed(2)}`
        ]);
    }
    dumpTable(tableRows);

    const bucketNames = [...Object.keys(tableResult.bucketTables)];
    if (bucketNames.length > 1 && !bucketName) {
        console.log('\nper bucket:');
        for (const [ bucketName, table ] of [...Object.entries(tableResult.bucketTables)].sort((a, b) => (b[1].estimated30DayRow?.totalCost || 0) - (a[1].estimated30DayRow?.totalCost || 0))) {
            const estTotal = table.estimated30DayRow?.totalCost || 0;
            const pieces = [ `$${estTotal.toFixed(2)}`.padStart(7, ' '), bucketName ];
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
        const width = Math.max(...[sumClassAOperations, sumClassBOperations].map(v => v.toString().length));
        console.log('\ntotals:');
        console.log(`  class a operations:  ${sumClassAOperations.toString().padStart(width)}`);
        console.log(`  class b operations:  ${sumClassBOperations.toString().padStart(width)}`);
    }
}
