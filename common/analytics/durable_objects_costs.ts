import { DurableObjectsNamespace, listDurableObjectsNamespaces } from 'https://raw.githubusercontent.com/skymethod/denoflare/v0.4.1/common/cloudflare_api.ts';
import { Profile } from '../config.ts';
import { CfGqlClient, CfGqlResultInfo } from './cfgql_client.ts';

export async function computeDurableObjectsCostsTable(client: CfGqlClient, opts: { lookbackDays: number; }): Promise<DurableObjectsCostsTable> {
    const { lookbackDays } = opts;
    const end = utcCurrentDate();
    const start = addDaysToDate(end, -lookbackDays);

    const [ storage, periodic, invocations, namespaces ] = await Promise.all([ 
        client.getDurableObjectStorageByDate(start, end),
        client.getDurableObjectPeriodicMetricsByDate(start, end),
        client.getDurableObjectInvocationsByDate(start, end),
        tryListDurableObjectsNamespaces(client.profile),
    ]);

    const gqlResultInfos = {
        'storage': storage.info,
        'periodic': periodic.info,
        'invocations': invocations.info,
    };

    const rowsByNamespace: Record<string, DurableObjectsCostsRow[]> = {};
    const rowsByDate: Record<string, DurableObjectsCostsRow[]> = {};
    for (const pRow of periodic.rows) {
        const { 
            date,
            namespaceId,
            maxActiveWebsocketConnections, 
            sumInboundWebsocketMsgCount, 
            sumOutboundWebsocketMsgCount,
            sumSubrequests,
            sumActiveTime,
            sumStorageReadUnits,
            sumStorageWriteUnits,
            sumStorageDeletes,
         } = pRow;
        let rows = rowsByNamespace[namespaceId];
        if (!rows) {
            rows = [];
            rowsByNamespace[namespaceId] = rows;
        }
        let dateRows = rowsByDate[date];
        if (!dateRows) {
            dateRows = [];
            rowsByDate[date] = dateRows;
        }
        const { sumRequests } = invocations.rows.filter(v => v.date === date && v.namespaceId === namespaceId)[0] || { sumRequests: 0 };
        const { requestsCost, websocketsCost, subrequestsCost, activeCost, readUnitsCost, writeUnitsCost, deletesCost, totalCost, activeGbSeconds } = 
            computeCosts({ sumRequests, sumInboundWebsocketMsgCount, sumSubrequests, sumActiveTime, sumStorageReadUnits, sumStorageWriteUnits, sumStorageDeletes, excludeFreeUsage: false, storageCost: 0 });

        const row: DurableObjectsCostsRow = {
            date,
            sumRequests,
            requestsCost,
            maxActiveWebsocketConnections,
            sumInboundWebsocketMsgCount,
            sumOutboundWebsocketMsgCount,
            websocketsCost,
            sumSubrequests,
            subrequestsCost,
            sumActiveTime,
            activeGbSeconds,
            activeCost,
            sumStorageReadUnits,
            readUnitsCost,
            sumStorageWriteUnits,
            writeUnitsCost,
            sumStorageDeletes,
            deletesCost,
            totalCost,
        };
        rows.push(row);
        dateRows.push(row);
    }
    const namespaceTables: Record<string, DurableObjectsDailyCostsTable> = {};
    for (const [ namespaceId, rows] of Object.entries(rowsByNamespace)) {
        const estimated30DayRow = computeEstimated30DayRow(rows, false);
        const namespace = namespaces.find(v => v.id === namespaceId);
        namespaceTables[namespaceId] = { rows, estimated30DayRow, namespace, estimated30DayRowMinusFree: undefined };
    }
    const accountRows: DurableObjectsCostsRow[] = [];
    for (const [ date, dateRows] of Object.entries(rowsByDate)) {
        const { maxStoredBytes } = storage.rows.filter(v => v.date === date)[0] || { maxStoredBytes: 0 };
        const storageGb = maxStoredBytes / 1024 / 1024 / 1024;
        const storageCost = storageGb * .20 / 30; // $0.20 per additional 1GB of stored data
        accountRows.push(computeTotalRow(date, dateRows, { storageGb, storageCost }));
    }
    const storageCost = accountRows.length > 0 ? accountRows.map(v => v.storageCost || 0).reduce((a, b) => a + b) : 0;
    const accountOpts = { storageGb: 0, storageCost };
    const estimated30DayRow = computeEstimated30DayRow(accountRows, false, accountOpts);
    const estimated30DayRowMinusFree = computeEstimated30DayRow(accountRows, true, accountOpts);
    const accountTable: DurableObjectsDailyCostsTable = { rows: accountRows, estimated30DayRow, estimated30DayRowMinusFree, namespace: undefined };
    return { accountTable, namespaceTables, gqlResultInfos };
}

export interface DurableObjectsCostsTable {
    readonly accountTable: DurableObjectsDailyCostsTable;
    readonly namespaceTables: Record<string, DurableObjectsDailyCostsTable>; // key = namespaceId
    readonly gqlResultInfos: Record<string, CfGqlResultInfo>;
}

export interface DurableObjectsDailyCostsTable {
    readonly rows: readonly DurableObjectsCostsRow[];
    readonly estimated30DayRow: DurableObjectsCostsRow | undefined;
    readonly estimated30DayRowMinusFree: DurableObjectsCostsRow | undefined;
    readonly namespace: DurableObjectsNamespace | undefined;
}

export interface DurableObjectsCostsRow {
    readonly date: string;
    readonly sumRequests: number;
    readonly requestsCost: number;
    readonly maxActiveWebsocketConnections: number;
    readonly sumInboundWebsocketMsgCount: number;
    readonly sumOutboundWebsocketMsgCount: number;
    readonly websocketsCost: number;
    readonly sumSubrequests: number;
    readonly subrequestsCost: number;
    readonly sumActiveTime: number;
    readonly activeGbSeconds: number;
    readonly activeCost: number;
    readonly sumStorageReadUnits: number;
    readonly readUnitsCost: number;
    readonly sumStorageWriteUnits: number;
    readonly writeUnitsCost: number;
    readonly sumStorageDeletes: number;
    readonly deletesCost: number;
    readonly storageGb?: number;
    readonly storageCost?: number;
    readonly totalCost: number;
}

//

function computeCosts(input: { sumRequests: number, sumInboundWebsocketMsgCount: number, sumSubrequests: number, sumActiveTime: number, sumStorageReadUnits: number, sumStorageWriteUnits: number, sumStorageDeletes: number,
        excludeFreeUsage: boolean, storageCost: number | undefined }) {
    const { sumActiveTime, sumStorageReadUnits, sumStorageWriteUnits, sumStorageDeletes, excludeFreeUsage, storageCost } = input;
    const { sumRequests, sumInboundWebsocketMsgCount, sumSubrequests } = (function() {
        let { sumRequests, sumInboundWebsocketMsgCount, sumSubrequests } = input;
        if (excludeFreeUsage) {
            let remaining = 1000000; // 1 million requests included
            let take = Math.min(remaining, sumRequests);
            if (take > 0) { sumRequests -= take; remaining -= take; }
            take = Math.min(remaining, sumInboundWebsocketMsgCount);
            if (take > 0) { sumInboundWebsocketMsgCount -= take; remaining -= take; }
            take = Math.min(remaining, sumSubrequests);
            if (take > 0) { sumSubrequests -= take; remaining -= take; }
        }
        return { sumRequests, sumInboundWebsocketMsgCount, sumSubrequests };
    })();
    const requestsCost = sumRequests / 1000000 * 0.15; // $0.15 per additional 1 million requests
    const websocketsCost = sumInboundWebsocketMsgCount / 1000000 * 0.15; // $0.15 per additional 1 million requests (inbound only per discord)
    const subrequestsCost = sumSubrequests / 1000000 * 0.15; // $0.15 per additional 1 million requests
    const activeTimeSeconds = sumActiveTime / 1000 / 1000;
    let activeGbSeconds = activeTimeSeconds * 128 / 1024;
    if (excludeFreeUsage) {
        activeGbSeconds = Math.max(0, activeGbSeconds - 400000);
    }
    const activeCost = activeGbSeconds / 400000 * 12.50; // $12.50 per additional 400,000 GB-second duration
    const readUnitsCost = (excludeFreeUsage ? (Math.max(0, sumStorageReadUnits - 1000000)) : sumStorageReadUnits) / 1000000 * .20; // $0.20 per additional 1 million read units
    const writeUnitsCost = (excludeFreeUsage ? (Math.max(0, sumStorageWriteUnits - 1000000)) : sumStorageWriteUnits) / 1000000 * 1; // $1.00 per additional 1 million write units
    const deletesCost = (excludeFreeUsage ? (Math.max(0, sumStorageDeletes - 1000000)) : sumStorageDeletes) / 1000000 * 1; // $1.00 per additional 1 million delete operations
    let newStorageCost = storageCost || 0;
    if (excludeFreeUsage) newStorageCost = Math.max(0, newStorageCost - 0.20);
    const totalCost = requestsCost + websocketsCost + subrequestsCost + activeCost + readUnitsCost + writeUnitsCost + deletesCost + newStorageCost;

    return { requestsCost, websocketsCost, subrequestsCost, activeCost, readUnitsCost, writeUnitsCost, deletesCost, totalCost, activeGbSeconds, newStorageCost };
}

async function tryListDurableObjectsNamespaces(profile: Profile): Promise<readonly DurableObjectsNamespace[]> {
    try {
        return await listDurableObjectsNamespaces(profile.accountId, profile.apiToken);
    } catch (e) {
        console.warn(e);
        return [];
    }
}

function computeTotalRow(date: string, rows: DurableObjectsCostsRow[], opts?: { storageGb: number, storageCost: number }): DurableObjectsCostsRow {
    let computedStorageCost = false;
    const computeStorageCostOnce = () => {
        const rt = !computedStorageCost ? (opts?.storageCost || 0) : 0;
        computedStorageCost = true;
        return rt;
    };
    return rows.reduce((lhs, rhs) => ({
        date,
        sumRequests: lhs.sumRequests + rhs.sumRequests,
        requestsCost: lhs.requestsCost + rhs.requestsCost,
        maxActiveWebsocketConnections: lhs.maxActiveWebsocketConnections + rhs.maxActiveWebsocketConnections,
        sumInboundWebsocketMsgCount: lhs.sumInboundWebsocketMsgCount + rhs.sumInboundWebsocketMsgCount,
        sumOutboundWebsocketMsgCount: lhs.sumOutboundWebsocketMsgCount + rhs.sumOutboundWebsocketMsgCount,
        websocketsCost: lhs.websocketsCost + rhs.websocketsCost,
        sumSubrequests: lhs.sumSubrequests + rhs.sumSubrequests,
        subrequestsCost: lhs.subrequestsCost + rhs.subrequestsCost,
        sumActiveTime: lhs.sumActiveTime + rhs.sumActiveTime,
        activeGbSeconds: lhs.activeGbSeconds + rhs.activeGbSeconds,
        activeCost: lhs.activeCost + rhs.activeCost,
        sumStorageReadUnits: lhs.sumStorageReadUnits + rhs.sumStorageReadUnits,
        readUnitsCost: lhs.readUnitsCost + rhs.readUnitsCost,
        sumStorageWriteUnits: lhs.sumStorageWriteUnits + rhs.sumStorageWriteUnits,
        writeUnitsCost: lhs.writeUnitsCost + rhs.writeUnitsCost,
        sumStorageDeletes: lhs.sumStorageDeletes + rhs.sumStorageDeletes,
        deletesCost: lhs.deletesCost + rhs.deletesCost,
        storageGb: opts?.storageGb,
        storageCost: opts?.storageCost,
        totalCost: lhs.totalCost + rhs.totalCost + computeStorageCostOnce(),
    }));
}


function multiplyRow(row: DurableObjectsCostsRow, multiplier: number): DurableObjectsCostsRow {
    return {
        date: '',
        sumRequests: row.sumRequests * multiplier,
        requestsCost: row.requestsCost * multiplier,
        maxActiveWebsocketConnections: row.maxActiveWebsocketConnections * multiplier,
        sumInboundWebsocketMsgCount: row.sumInboundWebsocketMsgCount * multiplier,
        sumOutboundWebsocketMsgCount: row.sumOutboundWebsocketMsgCount * multiplier,
        websocketsCost: row.websocketsCost * multiplier,
        sumSubrequests: row.sumSubrequests * multiplier,
        subrequestsCost: row.subrequestsCost * multiplier,
        sumActiveTime: row.sumActiveTime * multiplier,
        activeGbSeconds: row.activeGbSeconds * multiplier,
        activeCost: row.activeCost * multiplier,
        sumStorageReadUnits: row.sumStorageReadUnits * multiplier,
        readUnitsCost: row.readUnitsCost * multiplier,
        sumStorageWriteUnits: row.sumStorageWriteUnits * multiplier,
        writeUnitsCost: row.writeUnitsCost * multiplier,
        sumStorageDeletes: row.sumStorageDeletes * multiplier,
        deletesCost: row.deletesCost * multiplier,
        storageGb: row.storageGb === undefined ? undefined : row.storageGb * multiplier,
        storageCost: row.storageCost === undefined ? undefined : row.storageCost * multiplier,
        totalCost: row.totalCost * multiplier,
    };
}

function computeEstimated30DayRow(rows: DurableObjectsCostsRow[], excludeFreeUsage: boolean, opts?: { storageGb: number, storageCost: number }): DurableObjectsCostsRow | undefined {
    if (rows.length <= 1) return undefined;
    
    const sum = computeTotalRow('', rows.slice(0, -1), opts); // remove the most recent day, since it's always partial
    const days = rows.length - 1;
    const estRow = multiplyRow(sum, 30 / days);

    const { sumRequests, sumInboundWebsocketMsgCount, sumSubrequests, sumStorageReadUnits, sumStorageWriteUnits, sumStorageDeletes, sumActiveTime, maxActiveWebsocketConnections, sumOutboundWebsocketMsgCount, storageGb, storageCost } = estRow;
    const { requestsCost, websocketsCost, subrequestsCost, activeCost, readUnitsCost, writeUnitsCost, deletesCost, totalCost, activeGbSeconds, newStorageCost } = 
            computeCosts({ sumRequests, sumInboundWebsocketMsgCount, sumSubrequests, sumActiveTime, sumStorageReadUnits, sumStorageWriteUnits, sumStorageDeletes, excludeFreeUsage, storageCost });

    return {
        date: '',
        sumRequests,
        requestsCost,
        maxActiveWebsocketConnections,
        sumInboundWebsocketMsgCount,
        sumOutboundWebsocketMsgCount,
        websocketsCost,
        sumSubrequests,
        subrequestsCost,
        sumActiveTime,
        activeGbSeconds,
        activeCost,
        sumStorageReadUnits,
        readUnitsCost,
        sumStorageWriteUnits,
        writeUnitsCost,
        sumStorageDeletes,
        deletesCost,
        storageGb,
        storageCost: newStorageCost,
        totalCost,
    };
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
