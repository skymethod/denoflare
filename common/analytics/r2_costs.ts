import { Bucket, listR2Buckets } from '../cloudflare_api.ts';
import { Profile } from '../config.ts';
import { CfGqlClient, CfGqlResultInfo } from './cfgql_client.ts';

export async function computeR2CostsTable(client: CfGqlClient, opts: { lookbackDays: number } | { start: string, end: string }): Promise<R2CostsTable> {
    const { start, end } = (() => {
        if ('lookbackDays' in opts) {
            const end = utcCurrentDate();
            const start = addDaysToDate(end, -opts.lookbackDays);
            return { start, end };
        } else {
            const { start, end } = opts;
            return { start, end };
        }
    })();
   
    const [ storage, operationsA, operationsB, buckets ] = await Promise.all([ 
        client.getR2StorageByDate(start, end),
        client.getR2OperationsByDate('A', start, end),
        client.getR2OperationsByDate('B', start, end),
        tryListBuckets(client.profile),
    ]);

    const gqlResultInfos = {
        'storage': storage.info,
        'operationsA': operationsA.info,
        'operationsB': operationsB.info,
    };

    const rowsByBucket: Record<string, R2CostsRow[]> = {};
    const rowsByDate: Record<string, R2CostsRow[]> = {};
    for (const pRow of storage.rows) {
        const { 
            date,
            bucketName,
         } = pRow;
        let rows = rowsByBucket[bucketName];
        if (!rows) {
            rows = [];
            rowsByBucket[bucketName] = rows;
        }
        let dateRows = rowsByDate[date];
        if (!dateRows) {
            dateRows = [];
            rowsByDate[date] = dateRows;
        }
        const { sumSuccessfulRequests: classAOperations } = operationsA.rows.filter(v => v.date === date && v.bucketName === bucketName)[0] || { sumSuccessfulRequests: 0 };
        const { sumSuccessfulRequests: classBOperations } = operationsB.rows.filter(v => v.date === date && v.bucketName === bucketName)[0] || { sumSuccessfulRequests: 0 };

        const { classAOperationsCost, classBOperationsCost, totalCost } = 
            computeCosts({ classAOperations, classBOperations, excludeFreeUsage: false, storageCost: 0 });

        const row: R2CostsRow = {
            date,
            classAOperations,
            classAOperationsCost,
            classBOperations,
            classBOperationsCost,
            
            totalCost,
        };
        rows.push(row);
        dateRows.push(row);
    }
    const bucketTables: Record<string, R2DailyCostsTable> = {};
    for (const [ bucketName, rows] of Object.entries(rowsByBucket)) {
        const estimated30DayRow = computeEstimated30DayRow(rows, false);
        const bucket = buckets.find(v => v.name === bucketName);
        bucketTables[bucketName] = { rows, estimated30DayRow, bucket, estimated30DayRowMinusFree: undefined };
    }
    const accountRows: R2CostsRow[] = [];
    for (const [ date, dateRows] of Object.entries(rowsByDate)) {
        const { maxMetadataSize, maxPayloadSize } = storage.rows.filter(v => v.date === date)[0] || { maxMetadataSize: 0, maxPayloadSize: 0 };
        const storageGb = (maxMetadataSize + maxPayloadSize) / 1024 / 1024 / 1024;
        const storageCost = storageGb * .015 / 30; // $0.015 per 1 GB-month of storage
        accountRows.push(computeTotalRow(date, dateRows, { storageGb, storageCost }));
    }
    const storageCost = accountRows.length > 0 ? accountRows.map(v => v.storageCost || 0).reduce((a, b) => a + b) : 0;
    const accountOpts = { storageGb: 0, storageCost };
    const estimated30DayRow = computeEstimated30DayRow(accountRows, false, accountOpts);
    const estimated30DayRowMinusFree = computeEstimated30DayRow(accountRows, true, accountOpts);
    const accountTable: R2DailyCostsTable = { rows: accountRows, estimated30DayRow, estimated30DayRowMinusFree, bucket: undefined };
    return { accountTable, bucketTables, gqlResultInfos };
}

export interface R2CostsTable {
    readonly accountTable: R2DailyCostsTable;
    readonly bucketTables: Record<string, R2DailyCostsTable>; // key = bucket name
    readonly gqlResultInfos: Record<string, CfGqlResultInfo>;
}

export interface R2DailyCostsTable {
    readonly rows: readonly R2CostsRow[];
    readonly estimated30DayRow: R2CostsRow | undefined;
    readonly estimated30DayRowMinusFree: R2CostsRow | undefined;
    readonly bucket: Bucket | undefined;
}

export interface R2CostsRow {
    readonly date: string;

    readonly classAOperations: number;
    readonly classAOperationsCost: number;
    readonly classBOperations: number;
    readonly classBOperationsCost: number;
    readonly storageGb?: number;
    readonly storageCost?: number;
    readonly totalCost: number;
}

//

function computeCosts(input: { classAOperations: number, classBOperations: number,
        excludeFreeUsage: boolean, storageCost: number | undefined }) {
    const { classAOperations, classBOperations, excludeFreeUsage, storageCost } = input;

    const classAOperationsCost = (excludeFreeUsage ? Math.max(classAOperations - 1000000, 0) : classAOperations) / 1000000 * 4.50; // $4.50 / million requests, 1,000,000 included per month
    const classBOperationsCost = (excludeFreeUsage ? Math.max(classBOperations - 10000000, 0): classBOperations) / 1000000 * 4.50; // $0.36 / million requests, 10,000,000 included per month
    let newStorageCost = storageCost || 0;
    if (excludeFreeUsage) newStorageCost = Math.max(0, newStorageCost - 0.15); // 10 GB-month = $0.15 free
    const totalCost = classAOperationsCost + classBOperationsCost + newStorageCost;

    return { classAOperationsCost, classBOperationsCost, totalCost, newStorageCost };
}

async function tryListBuckets(profile: Profile): Promise<readonly Bucket[]> {
    try {
        return await listR2Buckets(profile.accountId, profile.apiToken);
    } catch (e) {
        console.warn(e);
        return [];
    }
}

function computeTotalRow(date: string, rows: R2CostsRow[], opts?: { storageGb: number, storageCost: number }): R2CostsRow {
    let computedStorageCost = false;
    const computeStorageCostOnce = () => {
        const rt = !computedStorageCost ? (opts?.storageCost || 0) : 0;
        computedStorageCost = true;
        return rt;
    };
    return rows.reduce((lhs, rhs) => ({
        date,
        classAOperations: lhs.classAOperations + rhs.classAOperations,
        classAOperationsCost: lhs.classAOperationsCost + rhs.classAOperationsCost,
        classBOperations: lhs.classBOperations + rhs.classBOperations,
        classBOperationsCost: lhs.classBOperationsCost + rhs.classBOperationsCost,
        storageGb: opts?.storageGb,
        storageCost: opts?.storageCost,
        totalCost: lhs.totalCost + rhs.totalCost + computeStorageCostOnce(),
    }));
}


function multiplyRow(row: R2CostsRow, multiplier: number): R2CostsRow {
    return {
        date: '',
        classAOperations: row.classAOperations * multiplier,
        classAOperationsCost: row.classAOperationsCost * multiplier,
        classBOperations: row.classBOperations * multiplier,
        classBOperationsCost: row.classBOperationsCost * multiplier,
        storageGb: row.storageGb === undefined ? undefined : row.storageGb * multiplier,
        storageCost: row.storageCost === undefined ? undefined : row.storageCost * multiplier,
        totalCost: row.totalCost * multiplier,
    };
}

function computeEstimated30DayRow(rows: R2CostsRow[], excludeFreeUsage: boolean, opts?: { storageGb: number, storageCost: number }): R2CostsRow | undefined {
    if (rows.length <= 1) return undefined;
    
    const sum = computeTotalRow('', rows.slice(0, -1), opts); // remove the most recent day, since it's always partial
    const days = rows.length - 1;
    const estRow = multiplyRow(sum, 30 / days);

    const { classAOperations, classBOperations, storageGb, storageCost } = estRow;
    const { classAOperationsCost, classBOperationsCost, totalCost, newStorageCost } = 
            computeCosts({ classAOperations, classBOperations, excludeFreeUsage, storageCost });

    return {
        date: '',
        classAOperations,
        classAOperationsCost,
        classBOperations,
        classBOperationsCost,
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
