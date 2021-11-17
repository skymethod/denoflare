import { Profile } from '../common/config.ts';
import { CLI_VERSION } from './cli_version.ts';
import { loadConfig, resolveProfile } from './config_loader.ts';
import { CfGqlClient } from './analytics/cfgql_client.ts';

export async function analytics(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    const firstArg = args[0];
    if (options.help || typeof firstArg !== 'string' ) {
        dumpHelp();
        return;
    }
    if (firstArg === 'do' || firstArg === 'durable-objects') {
        const config = await loadConfig(options);
        const profile = await resolveProfile(config, options);
        await dumpDurableObjects(profile);
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

async function dumpDurableObjects(profile: Profile) {
    const client = new CfGqlClient(profile);
    // CfGqlClient.DEBUG = true;

    const end = utcCurrentDate();
    const start = addDaysToDate(end, -28);

    const [ storage, periodic, invocations ] = await Promise.all([ 
        client.getDurableObjectStorageByDate(start, end),
        client.getDurableObjectPeriodicMetricsByDate(start, end),
        client.getDurableObjectInvocationsByDate(start, end),
    ]);

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
    const sums = {
        reqCost: 0,
        wsCost: 0,
        subreqCost: 0,
        activeCost: 0,
        readUnitsCost: 0,
        writeUnitsCost: 0,
        deletesCost: 0,
        storageCost: 0,
        totalCost: 0,
    };
    for (const row of periodic.rows) {
        const { sumRequests } = invocations.rows.filter(v => v.date === row.date)[0];
        const { maxStoredBytes } = storage.rows.filter(v => v.date === row.date)[0];

        const reqCost = sumRequests / 1000000 * 0.15;
        sums.reqCost += reqCost;
        const wsCost = row.sumInboundWebsocketMsgCount / 1000000 * 0.15;
        sums.wsCost += wsCost;
        const subreqCost = row.sumSubrequests / 1000000 * 0.15;
        sums.subreqCost += subreqCost;
        const activeTimeSeconds = row.sumActiveTime / 1000 / 1000;
        const activeGbSeconds = activeTimeSeconds * 128 / 1024;
        const activeCost = activeGbSeconds / 400000 * 12.50;
        sums.activeCost += activeCost;
        const readUnitsCost = row.sumStorageReadUnits / 1000000 * .20;
        sums.readUnitsCost += readUnitsCost;
        const writeUnitsCost = row.sumStorageWriteUnits / 1000000 * 1;
        sums.writeUnitsCost += writeUnitsCost;
        const deletesCost = row.sumStorageDeletes / 1000000 * 1;
        sums.deletesCost += deletesCost;
        const storageGb = maxStoredBytes / 1024 / 1024 / 1024;
        const storageCost = storageGb * .20 / 30;
        sums.storageCost += storageCost;
        const totalCost = reqCost + wsCost + subreqCost + activeCost + readUnitsCost + writeUnitsCost + deletesCost + storageCost;
        sums.totalCost += totalCost;

        const tableRow = [
            row.date,
            sumRequests,
            `$${reqCost.toFixed(2)}`,
            row.maxActiveWebsocketConnections,
            row.sumInboundWebsocketMsgCount,
            row.sumOutboundWebsocketMsgCount,
            `$${wsCost.toFixed(2)}`,
            row.sumSubrequests,
            `$${subreqCost.toFixed(2)}`,
            `${activeGbSeconds.toFixed(2)}gb-s`, 
            `$${activeCost.toFixed(2)}`, 
            row.sumStorageReadUnits, 
            `$${readUnitsCost.toFixed(2)}`,
            row.sumStorageWriteUnits,
            `$${writeUnitsCost.toFixed(2)}`,
            row.sumStorageDeletes,
            `$${deletesCost.toFixed(2)}`,
            `${storageGb.toFixed(2)}gb`,
            `$${storageCost.toFixed(2)}`,
            `$${totalCost.toFixed(2)}`,
        ];
        tableRows.push(tableRow);
    }
    tableRows.push([
        '', 
        '', 
        `$${sums.reqCost.toFixed(2)}`, 
        '', 
        '', 
        '', 
        `$${sums.wsCost.toFixed(2)}`, 
        '', 
        `$${sums.subreqCost.toFixed(2)}`, 
        '', 
        `$${sums.activeCost.toFixed(2)}`, 
        '', 
        `$${sums.readUnitsCost.toFixed(2)}`, 
        '', 
        `$${sums.writeUnitsCost.toFixed(2)}`, 
        '', 
        `$${sums.deletesCost.toFixed(2)}`,
        '',
        `$${sums.storageCost.toFixed(2)}`,
        `$${sums.totalCost.toFixed(2)}`
    ]);
    dumpTable(tableRows);

    for (const { fetchMillis, cost, budget } of [ storage, periodic, invocations ]) {
        console.log(`fetchTime: ${fetchMillis}ms, cost: ${cost}, budget: ${budget} (${Math.round(budget / cost)} left of those)`);
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

function utcCurrentDate(): string {
    return new Date().toISOString().substring(0, 10);
}

function addDaysToDate(date: string, days: number) {
    const d = new Date(`${date}T00:00:00Z`);
    return new Date(
        d.getFullYear(), 
        d.getMonth(), 
        d.getDate() + days,
        d.getHours(),
        d.getMinutes(),
        d.getSeconds(),
        d.getMilliseconds()
    ).toISOString().substring(0, 10);
}
