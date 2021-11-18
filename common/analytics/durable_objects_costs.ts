import { CfGqlClient, CfGqlResultInfo } from './cfgql_client.ts';

export async function computeDurableObjectsCostsTable(client: CfGqlClient, opts: { lookbackDays: number; }): Promise<DurableObjectsCostsTable> {
    const { lookbackDays } = opts;
    const end = utcCurrentDate();
    const start = addDaysToDate(end, -lookbackDays);

    const [ storage, periodic, invocations ] = await Promise.all([ 
        client.getDurableObjectStorageByDate(start, end),
        client.getDurableObjectPeriodicMetricsByDate(start, end),
        client.getDurableObjectInvocationsByDate(start, end),
    ]);

    const gqlResultInfos = {
        'storage': storage.info,
        'periodic': periodic.info,
        'invocations': invocations.info,
    };

    const rows: DurableObjectsCostsRow[] = [];
    for (const pRow of periodic.rows) {
        const { 
            date, 
            maxActiveWebsocketConnections, 
            sumInboundWebsocketMsgCount, 
            sumOutboundWebsocketMsgCount,
            sumSubrequests,
            sumActiveTime,
            sumStorageReadUnits,
            sumStorageWriteUnits,
            sumStorageDeletes,
         } = pRow;
        const { sumRequests } = invocations.rows.filter(v => v.date === date)[0] || { sumRequests: 0 };
        const requestsCost = sumRequests / 1000000 * 0.15; // $0.15 per additional 1 million requests
        const websocketsCost = sumInboundWebsocketMsgCount / 1000000 * 0.15; // $0.15 per additional 1 million requests (inbound only per discord)
        const subrequestsCost = sumSubrequests / 1000000 * 0.15; // $0.15 per additional 1 million requests
        const activeTimeSeconds = sumActiveTime / 1000 / 1000;
        const activeGbSeconds = activeTimeSeconds * 128 / 1024;
        const activeCost = activeGbSeconds / 400000 * 12.50; // $12.50 per additional 400,000 GB-second duration
        const readUnitsCost = sumStorageReadUnits / 1000000 * .20; // $0.20 per additional 1 million read units
        const writeUnitsCost = sumStorageWriteUnits / 1000000 * 1; // $1.00 per additional 1 million write units
        const deletesCost = sumStorageDeletes / 1000000 * 1; // $1.00 per additional 1 million delete operations

        const { maxStoredBytes } = storage.rows.filter(v => v.date === date)[0] || { maxStoredBytes: 0 };
        const storageGb = maxStoredBytes / 1024 / 1024 / 1024;
        const storageCost = storageGb * .20 / 30; // $0.20 per additional 1GB of stored data

        const totalCost = requestsCost + websocketsCost + subrequestsCost + activeCost + readUnitsCost + writeUnitsCost + deletesCost + storageCost;

        rows.push({
            date,
            sumRequests,
            requestsCost,
            maxActiveWebsocketConnections,
            sumInboundWebsocketMsgCount,
            sumOutboundWebsocketMsgCount,
            websocketsCost,
            sumSubrequests,
            subrequestsCost,
            activeGbSeconds,
            activeCost,
            sumStorageReadUnits,
            readUnitsCost,
            sumStorageWriteUnits,
            writeUnitsCost,
            sumStorageDeletes,
            deletesCost,
            storageGb,
            storageCost,
            totalCost,
        });
    }
    const totalRow = computeTotalRow(rows);
    return { rows, totalRow, gqlResultInfos };
}

export interface DurableObjectsCostsTable {
    readonly rows: readonly DurableObjectsCostsRow[];
    readonly totalRow: DurableObjectsCostsRow;
    readonly gqlResultInfos: Record<string, CfGqlResultInfo>;
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
    readonly activeGbSeconds: number;
    readonly activeCost: number;
    readonly sumStorageReadUnits: number;
    readonly readUnitsCost: number;
    readonly sumStorageWriteUnits: number;
    readonly writeUnitsCost: number;
    readonly sumStorageDeletes: number;
    readonly deletesCost: number;
    readonly storageGb: number;
    readonly storageCost: number;
    readonly totalCost: number;
}

//

function computeTotalRow(rows: DurableObjectsCostsRow[]): DurableObjectsCostsRow {
    return rows.reduce((lhs, rhs) => {
        return {
            date: '',
            sumRequests: lhs.sumRequests + rhs.sumRequests,
            requestsCost: lhs.requestsCost + rhs.requestsCost,
            maxActiveWebsocketConnections: lhs.maxActiveWebsocketConnections + rhs.maxActiveWebsocketConnections,
            sumInboundWebsocketMsgCount: lhs.sumInboundWebsocketMsgCount + rhs.sumInboundWebsocketMsgCount,
            sumOutboundWebsocketMsgCount: lhs.sumOutboundWebsocketMsgCount + rhs.sumOutboundWebsocketMsgCount,
            websocketsCost: lhs.websocketsCost + rhs.websocketsCost,
            sumSubrequests: lhs.sumSubrequests + rhs.sumSubrequests,
            subrequestsCost: lhs.subrequestsCost + rhs.subrequestsCost,
            activeGbSeconds: lhs.activeGbSeconds + rhs.activeGbSeconds,
            activeCost: lhs.activeCost + rhs.activeCost,
            sumStorageReadUnits: lhs.sumStorageReadUnits + rhs.sumStorageReadUnits,
            readUnitsCost: lhs.readUnitsCost + rhs.readUnitsCost,
            sumStorageWriteUnits: lhs.sumStorageWriteUnits + rhs.sumStorageWriteUnits,
            writeUnitsCost: lhs.writeUnitsCost + rhs.writeUnitsCost,
            sumStorageDeletes: lhs.sumStorageDeletes + rhs.sumStorageDeletes,
            deletesCost: lhs.deletesCost + rhs.deletesCost,
            storageGb: lhs.storageGb + rhs.storageGb,
            storageCost: lhs.storageCost + rhs.storageCost,
            totalCost: lhs.totalCost + rhs.totalCost,
        }
    });
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
