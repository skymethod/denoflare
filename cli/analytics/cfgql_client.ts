import { checkEqual } from '../../common/check.ts';
import { Profile } from '../../common/config.ts';
import { GraphqlQuery } from './graphql.ts';

export class CfGqlClient {
    static DEBUG = false;

    private readonly profile: Profile;

    constructor(profile: Profile) {
        this.profile = profile;
    }

    async getDurableObjectPeriodicMetricsByDate(startDateInclusive: string, endDateInclusive: string): Promise<CfGqlResult<GetDurableObjectPeriodicMetricsByDateRow>> {
        return await _getDurableObjectPeriodicMetricsByDate(this.profile, startDateInclusive, endDateInclusive);
    }

    async getDurableObjectStorageByDate(startDateInclusive: string, endDateInclusive: string): Promise<CfGqlResult<GetDurableObjectStorageByDateRow>> {
        return await _getDurableObjectStorageByDate(this.profile, startDateInclusive, endDateInclusive);
    }

    async getDurableObjectInvocationsByDate(startDateInclusive: string, endDateInclusive: string): Promise<CfGqlResult<GetDurableObjectInvocationsByDateRow>> {
        return await _getDurableObjectInvocationsByDate(this.profile, startDateInclusive, endDateInclusive);
    }

}

export interface CfGqlResult<T> {
    readonly fetchMillis: number;
    readonly cost: number;
    readonly budget: number;
    readonly rows: readonly T[];
}

//

// deno-lint-ignore no-explicit-any
async function query(profile: Profile, queryFn: (q: GraphqlQuery) => void, variables: Record<string, unknown>): Promise<any> {
    const { accountId, apiToken } = profile;

    const q = GraphqlQuery.create()
        .scalar('cost')
        .object('viewer')
            .scalar('budget')
            .object('accounts').argObject('filter', 'accountTag', accountId)
            .scalar('accountTag');
    queryFn(q);

    const query = q.top().toString();
    if (CfGqlClient.DEBUG) console.log(query);

    const reqObj = { query, variables };

    const body = JSON.stringify(reqObj);
    const start = Date.now();
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': `Bearer ${apiToken}` }, body });
    const fetchMillis = Date.now() - start;
    if (CfGqlClient.DEBUG) console.log(res);

    if (res.status !== 200) throw new Error(`Bad res.status: ${res.status}, expected 200, text=${await res.text()}`);
    const contentType = res.headers.get('content-type');
    if (contentType !== 'application/json') throw new Error(`Bad res.contentType: ${contentType}, expected application/json, found ${contentType}, text=${await res.text()}`);
    const resObj = await res.json();
    resObj.fetchMillis = fetchMillis;
    if (CfGqlClient.DEBUG) console.log(JSON.stringify(resObj, undefined, 2));

    if (isGqlErrorResponse(resObj)) {
        throw new Error(resObj.errors.map(v => `${v.message} (${v.path.join('/')})`).join(', '));
    }
    return resObj;
}

interface GqlErrorResponse {
    readonly data: null,
    readonly errors: readonly {
        readonly message: string,
        readonly path: readonly string[],
        readonly extensions: Record<string, string>,
    }[];
}

// deno-lint-ignore no-explicit-any
function isGqlErrorResponse(obj: any): obj is GqlErrorResponse {
    return typeof obj === 'object' && obj.data === null && Array.isArray(obj.errors);
}

//#region GetDurableObjectPeriodicMetricsByDate

export interface GetDurableObjectPeriodicMetricsByDateRow {
    readonly date: string,
    readonly maxActiveWebsocketConnections: number,
    /** Sum of active time - microseconds */
    readonly sumActiveTime: number,
    readonly sumCpuTime: number,
    readonly sumExceededCpuErrors: number,
    readonly sumExceededMemoryErrors: number,
    readonly sumFatalInternalErrors: number,
    readonly sumInboundWebsocketMsgCount: number,
    readonly sumOutboundWebsocketMsgCount: number,
    readonly sumStorageDeletes: number,
    readonly sumStorageReadUnits: number,
    readonly sumStorageWriteUnits: number,
    readonly sumSubrequests: number,
}

async function _getDurableObjectPeriodicMetricsByDate(profile: Profile, startDateInclusive: string, endDateInclusive: string): Promise<CfGqlResult<GetDurableObjectPeriodicMetricsByDateRow>> {
    const resObj = await query(profile, q => q.object('durableObjectsPeriodicGroups')
        .argLong('limit', 10000)
        .argRaw('filter', `{date_geq: $start, date_leq: $end}`)
        .argRaw('orderBy', `[date_ASC]`)
        .object('dimensions')
            .scalar('date')
            .end()
        .object('max')
            .scalar('activeWebsocketConnections')
            .end()
        .object('sum')
            .scalar('activeTime')
            .scalar('cpuTime')
            .scalar('exceededCpuErrors')
            .scalar('exceededMemoryErrors')
            .scalar('fatalInternalErrors')
            .scalar('inboundWebsocketMsgCount')
            .scalar('outboundWebsocketMsgCount')
            .scalar('storageDeletes')
            .scalar('storageReadUnits')
            .scalar('storageWriteUnits')
            .scalar('subrequests'), { start: startDateInclusive, end: endDateInclusive });
    

    interface GqlResponse {
        data: {
            cost: number,
            viewer: {
                budget: number,
                accounts: {
                    accountTag: string,
                    durableObjectsPeriodicGroups: {
                        dimensions: {
                            date: string,
                        },
                        max: {
                            activeWebsocketConnections: number,
                        },
                        sum: {
                            activeTime: number,
                            cpuTime: number,
                            exceededCpuErrors: number,
                            exceededMemoryErrors: number,
                            fatalInternalErrors: number,
                            inboundWebsocketMsgCount: number,
                            outboundWebsocketMsgCount: number,
                            storageDeletes: number,
                            storageReadUnits: number,
                            storageWriteUnits: number,
                            subrequests: number,
                        },
                    }[],
                }[],
            },
        },
    }

    const fetchMillis = resObj.fetchMillis;
    const res = resObj as GqlResponse;
    const cost = res.data.cost;
    const budget = res.data.viewer.budget;
    const rows: GetDurableObjectPeriodicMetricsByDateRow[] = [];
    for (const account of res.data.viewer.accounts) {
        checkEqual('account.accountTag', account.accountTag, profile.accountId);
        for (const group of account.durableObjectsPeriodicGroups) {
            const date = group.dimensions.date;
            const maxActiveWebsocketConnections = group.max.activeWebsocketConnections;
            const sumActiveTime = group.sum.activeTime;
            const sumCpuTime = group.sum.cpuTime;
            const sumExceededCpuErrors = group.sum.exceededCpuErrors;
            const sumExceededMemoryErrors = group.sum.exceededMemoryErrors;
            const sumFatalInternalErrors = group.sum.fatalInternalErrors;
            const sumInboundWebsocketMsgCount = group.sum.inboundWebsocketMsgCount;
            const sumOutboundWebsocketMsgCount = group.sum.outboundWebsocketMsgCount;
            const sumStorageDeletes = group.sum.storageDeletes;
            const sumStorageReadUnits = group.sum.storageReadUnits;
            const sumStorageWriteUnits = group.sum.storageWriteUnits;
            const sumSubrequests = group.sum.subrequests;

            rows.push({ 
                date, 
                maxActiveWebsocketConnections, 
                sumActiveTime, 
                sumCpuTime, 
                sumExceededCpuErrors, 
                sumExceededMemoryErrors, 
                sumFatalInternalErrors, 
                sumInboundWebsocketMsgCount, 
                sumOutboundWebsocketMsgCount, 
                sumStorageDeletes,
                sumStorageReadUnits,
                sumStorageWriteUnits,
                sumSubrequests,
             });
        }
    }
    return { fetchMillis, cost, budget, rows };
}

//#endregion

//#region GetDurableObjectStorageByDate

export interface GetDurableObjectStorageByDateRow {
    readonly date: string,
    readonly maxStoredBytes: number,
}

async function _getDurableObjectStorageByDate(profile: Profile, startDateInclusive: string, endDateInclusive: string): Promise<CfGqlResult<GetDurableObjectStorageByDateRow>> {
    const resObj = await query(profile, q => q.object('durableObjectsStorageGroups')
        .argLong('limit', 10000)
        .argRaw('filter', `{date_geq: $start, date_leq: $end}`)
        .argRaw('orderBy', `[date_ASC]`)
        .object('dimensions')
            .scalar('date')
            .end()
        .object('max')
            .scalar('storedBytes')
            .end(), { start: startDateInclusive, end: endDateInclusive });
    

    interface GqlResponse {
        data: {
            cost: number,
            viewer: {
                budget: number,
                accounts: {
                    accountTag: string,
                    durableObjectsStorageGroups: {
                        dimensions: {
                            date: string,
                        },
                        max: {
                            storedBytes: number,
                        },
                    }[],
                }[],
            },
        },
    }

    const fetchMillis = resObj.fetchMillis;
    const res = resObj as GqlResponse;
    const cost = res.data.cost;
    const budget = res.data.viewer.budget;
    const rows: GetDurableObjectStorageByDateRow[] = [];
    for (const account of res.data.viewer.accounts) {
        checkEqual('account.accountTag', account.accountTag, profile.accountId);
        for (const group of account.durableObjectsStorageGroups) {
            const date = group.dimensions.date;
            const maxStoredBytes = group.max.storedBytes;
            rows.push({ date, maxStoredBytes });
        }
    }
    return { fetchMillis, cost, budget, rows };
}

//#endregion

//#region GetDurableObjectInvocationsByDate

export interface GetDurableObjectInvocationsByDateRow {
    readonly date: string,
    readonly avgSampleInterval: number,
    readonly sumRequests: number,
}

async function _getDurableObjectInvocationsByDate(profile: Profile, startDateInclusive: string, endDateInclusive: string): Promise<CfGqlResult<GetDurableObjectInvocationsByDateRow>> {
    const resObj = await query(profile, q => q.object('durableObjectsInvocationsAdaptiveGroups')
        .argLong('limit', 10000)
        .argRaw('filter', `{date_geq: $start, date_leq: $end}`)
        .argRaw('orderBy', `[date_ASC]`)
        .object('dimensions')
            .scalar('date')
            .end()
        .object('avg')
            .scalar('sampleInterval')
            .end()
        .object('sum')
            .scalar('requests')
            .end(), { start: startDateInclusive, end: endDateInclusive });
    

    interface GqlResponse {
        data: {
            cost: number,
            viewer: {
                budget: number,
                accounts: {
                    accountTag: string,
                    durableObjectsInvocationsAdaptiveGroups: {
                        dimensions: {
                            date: string,
                        },
                        avg: {
                            sampleInterval: number,
                        },
                        sum: {
                            requests: number,
                        },
                    }[],
                }[],
            },
        },
    }

    const fetchMillis = resObj.fetchMillis;
    const res = resObj as GqlResponse;
    const cost = res.data.cost;
    const budget = res.data.viewer.budget;
    const rows: GetDurableObjectInvocationsByDateRow[] = [];
    for (const account of res.data.viewer.accounts) {
        checkEqual('account.accountTag', account.accountTag, profile.accountId);
        for (const group of account.durableObjectsInvocationsAdaptiveGroups) {
            const date = group.dimensions.date;
            const avgSampleInterval = group.avg.sampleInterval;
            const sumRequests = group.sum.requests;
            rows.push({ date, avgSampleInterval, sumRequests });
        }
    }
    return { fetchMillis, cost, budget, rows };
}

//#endregion
