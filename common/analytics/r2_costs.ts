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
            maxMetadataSize,
            maxPayloadSize,
            maxObjectCount: objectCount,
            maxUploadCount: uploadCount,
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
        const { sumSuccessfulRequests: classAOperations, sumSuccessfulResponseObjectSize: classAEgress } = operationsA.rows.filter(v => v.date === date && v.bucketName === bucketName)[0] || { sumSuccessfulRequests: 0, sumSuccessfulResponseObjectSize: 0 };
        const { sumSuccessfulRequests: classBOperations, sumSuccessfulResponseObjectSize: classBEgress } = operationsB.rows.filter(v => v.date === date && v.bucketName === bucketName)[0] || { sumSuccessfulRequests: 0, sumSuccessfulResponseObjectSize: 0 };
        
        const storageGb = (maxMetadataSize + maxPayloadSize) / 1024 / 1024 / 1024;

        const { classAOperationsCost, classBOperationsCost, storageGbMo, storageCost, totalCost } = 
            computeCosts({ classAOperations, classBOperations, storageGb, excludeFreeUsage: false });

        const row: R2CostsRow = {
            date,
            classAOperations,
            classAOperationsCost,
            classBOperations,
            classBOperationsCost,
            classAEgress,
            classBEgress,
            objectCount,
            uploadCount,
            storageGb,
            storageGbMo,
            storageCost,
            totalCost,
        };
        rows.push(row);
        dateRows.push(row);
    }
    const bucketTables: Record<string, R2DailyCostsTable> = {};
    for (const [ bucketName, rows] of Object.entries(rowsByBucket)) {
        const bucket = buckets.find(v => v.name === bucketName);
        const totalRow = computeTotalRow('', rows);
        const estimated30DayRow = computeEstimated30DayRow(rows, { excludeFreeUsage: false });
        const estimated30DayRowMinusFree = computeEstimated30DayRow(rows, { excludeFreeUsage: true });
        bucketTables[bucketName] = { rows, totalRow, estimated30DayRow, estimated30DayRowMinusFree, bucket };
    }
    const accountRows: R2CostsRow[] = [];
    for (const [ date, dateRows] of Object.entries(rowsByDate)) {
        accountRows.push(computeTotalRow(date, dateRows));
    }
    const totalRow = computeTotalRow('', accountRows);
    const estimated30DayRow = computeEstimated30DayRow(accountRows, { excludeFreeUsage: false });
    const estimated30DayRowMinusFree = computeEstimated30DayRow(accountRows, { excludeFreeUsage: true });
    const accountTable: R2DailyCostsTable = { rows: accountRows, totalRow, estimated30DayRow, estimated30DayRowMinusFree, bucket: undefined };
    return { accountTable, bucketTables, gqlResultInfos };
}

export interface R2CostsTable {
    readonly accountTable: R2DailyCostsTable;
    readonly bucketTables: Record<string, R2DailyCostsTable>; // key = bucket name
    readonly gqlResultInfos: Record<string, CfGqlResultInfo>;
}

export interface R2DailyCostsTable {
    readonly rows: readonly R2CostsRow[];
    readonly totalRow: R2CostsRow;
    readonly estimated30DayRow: R2CostsRow | undefined;
    readonly estimated30DayRowMinusFree: R2CostsRow | undefined;
    readonly bucket: Bucket | undefined;
}

export interface R2CostsRow {
    readonly date: string;

    readonly classAOperations: number;
    readonly classAOperationsCost: number;
    readonly classAEgress: number;

    readonly classBOperations: number;
    readonly classBOperationsCost: number;
    readonly classBEgress: number;

    readonly objectCount: number;
    readonly uploadCount: number;
    readonly storageGb: number;
    readonly storageGbMo: number;
    readonly storageCost: number;
    readonly totalCost: number;
}

export function computeCosts(input: { classAOperations: number, classBOperations: number, storageGb: number, excludeFreeUsage: boolean }) {
    const { classAOperations, classBOperations, storageGb, excludeFreeUsage } = input;

    const classAOperationsCost = (excludeFreeUsage ? Math.max(classAOperations - 1000000, 0) : classAOperations) / 1000000 * 4.50; // $4.50 / million requests, 1,000,000 included per month
    const classBOperationsCost = (excludeFreeUsage ? Math.max(classBOperations - 10000000, 0): classBOperations) / 1000000 * 0.36; // $0.36 / million requests, 10,000,000 included per month
    const storageGbMo = storageGb / 30;
    let storageCost = storageGbMo * 0.015; // $0.015 per 1 GB-month of storage
    if (excludeFreeUsage) storageCost = Math.max(0, storageCost - 0.15); // 10 GB-month = $0.15 free
    const totalCost = classAOperationsCost + classBOperationsCost + storageCost;

    return { classAOperationsCost, classBOperationsCost, storageGbMo, storageCost, totalCost };
}

//

async function tryListBuckets(profile: Profile): Promise<readonly Bucket[]> {
    try {
        return await listR2Buckets(profile.accountId, profile.apiToken);
    } catch (e) {
        console.warn(e);
        return [];
    }
}

function computeTotalRow(date: string, rows: R2CostsRow[]): R2CostsRow {
    const rt = rows.reduce((lhs, rhs) => ({
        date,
        classAOperations: lhs.classAOperations + rhs.classAOperations,
        classAOperationsCost: lhs.classAOperationsCost + rhs.classAOperationsCost,
        classAEgress: lhs.classAEgress + rhs.classAEgress,
        classBOperations: lhs.classBOperations + rhs.classBOperations,
        classBOperationsCost: lhs.classBOperationsCost + rhs.classBOperationsCost,
        classBEgress: lhs.classBEgress + rhs.classBEgress,
        objectCount: lhs.objectCount + rhs.objectCount,
        uploadCount: lhs.uploadCount + rhs.uploadCount,
        storageGb: lhs.storageGb + rhs.storageGb,
        storageGbMo: lhs.storageGbMo + rhs.storageGbMo,
        storageCost: lhs.storageCost + rhs.storageCost,
        totalCost: lhs.totalCost + rhs.totalCost,
    }));
    return rt;
}

function computeEstimated30DayRow(rows: R2CostsRow[], opts: { excludeFreeUsage: boolean } ): R2CostsRow | undefined {
    const { excludeFreeUsage } = opts;
    if (rows.length <= 1) return undefined;
    
    const fullDays = rows.slice(0, -1); // remove the most recent day, since it's always partial
    const sumRow = computeTotalRow('', fullDays);

    const multiplyBy = 30 / fullDays.length;

    const classAOperations = Math.round(sumRow.classAOperations * multiplyBy);
    const classBOperations = Math.round(sumRow.classBOperations * multiplyBy);
    const storageGb = sumRow.storageGb * multiplyBy;
    
    const { classAOperationsCost, classBOperationsCost, storageGbMo, storageCost, totalCost } = computeCosts({ classAOperations, classBOperations, storageGb, excludeFreeUsage });

    const classAEgress = sumRow.classAEgress * multiplyBy;
    const classBEgress = sumRow.classBEgress * multiplyBy;

    return {
        date: '',
        classAOperations,
        classAOperationsCost,
        classAEgress,
        classBOperations,
        classBOperationsCost,
        classBEgress,
        objectCount: 0,
        uploadCount: 0,
        storageGb,
        storageGbMo,
        storageCost,
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
