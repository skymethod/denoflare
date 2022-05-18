import { checkEqual } from '../check.ts';
import { Profile } from '../config.ts';
import { GraphqlQuery } from './graphql.ts';

export class CfGqlClient {
    static DEBUG = false;
    static URL_TRANSFORMER: (url: string) => string = v => v;

    readonly profile: Profile;

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

    async getR2StorageByDate(startDateInclusive: string, endDateInclusive: string): Promise<CfGqlResult<GetR2StorageByDateRow>> {
        return await _getR2StorageByDate(this.profile, startDateInclusive, endDateInclusive);
    }

    async getR2OperationsByDate(operationClass: R2OperationClass, startDateInclusive: string, endDateInclusive: string): Promise<CfGqlResult<GetR2OperationsByDateRow>> {
        return await _getR2OperationsByDate(this.profile, operationClass, startDateInclusive, endDateInclusive);
    }

}

export interface CfGqlResultInfo {
    readonly fetchMillis: number;
    readonly cost: number;
    readonly budget: number;
}
export interface CfGqlResult<T> {
    readonly info: CfGqlResultInfo;
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
    const url = CfGqlClient.URL_TRANSFORMER('https://api.cloudflare.com/client/v4/graphql');
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': `Bearer ${apiToken}` }, body });
    const fetchMillis = Date.now() - start;
    if (CfGqlClient.DEBUG) console.log(res);

    if (res.status !== 200) throw new Error(`Bad res.status: ${res.status}, expected 200, text=${await res.text()}`);
    const contentType = res.headers.get('content-type');
    if (contentType !== 'application/json') throw new Error(`Bad res.contentType: ${contentType}, expected application/json, found ${contentType}, text=${await res.text()}`);
    const resObj = await res.json();
    resObj.fetchMillis = fetchMillis;
    if (CfGqlClient.DEBUG) console.log(JSON.stringify(resObj, undefined, 2));

    if (isGqlErrorResponse(resObj)) {
        throw new Error(resObj.errors.map(computeGqlErrorString).join(', '));
    }
    return resObj;
}

interface GqlError {
    readonly message: string;
    readonly path: readonly string[] | null;
    readonly extensions: Record<string, string>;
}

interface GqlErrorResponse {
    readonly data: null,
    readonly errors: readonly GqlError[];
}

// deno-lint-ignore no-explicit-any
function isGqlErrorResponse(obj: any): obj is GqlErrorResponse {
    return typeof obj === 'object' && obj.data === null && Array.isArray(obj.errors);
}

function computeGqlErrorString(error: GqlError) {
    const pieces = [ error.message ];
    if (error.path) pieces.push(`(${error.path.join('/')})`);
    if (error.extensions.code) pieces.push(`(code=${error.extensions.code})`);
    return pieces.join(' ');
}

//#region GetDurableObjectPeriodicMetricsByDate

export interface GetDurableObjectPeriodicMetricsByDateRow {
    readonly date: string,
    readonly namespaceId: string,
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
            .scalar('namespaceId')
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
                            namespaceId: string,
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
            const namespaceId = group.dimensions.namespaceId;
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
                namespaceId,
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
    return { info: { fetchMillis, cost, budget }, rows };
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
    return { info: { fetchMillis, cost, budget }, rows };
}

//#endregion

//#region GetDurableObjectInvocationsByDate

export interface GetDurableObjectInvocationsByDateRow {
    readonly date: string,
    readonly namespaceId: string,
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
            .scalar('namespaceId')
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
                            namespaceId: string,
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
            const namespaceId = group.dimensions.namespaceId;
            const avgSampleInterval = group.avg.sampleInterval;
            const sumRequests = group.sum.requests;
            rows.push({ date, namespaceId, avgSampleInterval, sumRequests });
        }
    }
    return { info: { fetchMillis, cost, budget }, rows };
}

//#endregion

//#region GetR2StorageByDate

export interface GetR2StorageByDateRow {
    readonly date: string,
    readonly bucketName: string,
    readonly maxMetadataSize: number,
    readonly maxPayloadSize: number,
    readonly maxObjectCount: number,
    readonly maxUploadCount: number,
}

async function _getR2StorageByDate(profile: Profile, startDateInclusive: string, endDateInclusive: string): Promise<CfGqlResult<GetR2StorageByDateRow>> {
    const resObj = await query(profile, q => q.object('r2StorageAdaptiveGroups')
        .argLong('limit', 10000)
        .argRaw('filter', `{date_geq: $start, date_leq: $end}`)
        .argRaw('orderBy', `[date_ASC]`)
        .object('dimensions')
            .scalar('date')
            .scalar('bucketName')
            .end()
        .object('max')
            .scalar('metadataSize')
            .scalar('payloadSize')
            .scalar('objectCount')
            .scalar('uploadCount')
            .end(), { start: startDateInclusive, end: endDateInclusive });
    

    interface GqlResponse {
        data: {
            cost: number,
            viewer: {
                budget: number,
                accounts: {
                    accountTag: string,
                    r2StorageAdaptiveGroups: {
                        dimensions: {
                            date: string,
                            bucketName: string,
                        },
                        max: {
                            metadataSize: number, // Max of metadata size
                            payloadSize: number, // Max of payload size
                            objectCount: number, // Max of object count
                            uploadCount: number, // Max of upload count
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
    const rows: GetR2StorageByDateRow[] = [];
    for (const account of res.data.viewer.accounts) {
        checkEqual('account.accountTag', account.accountTag, profile.accountId);
        for (const group of account.r2StorageAdaptiveGroups) {
            const date = group.dimensions.date;
            const bucketName = group.dimensions.bucketName;
            const maxMetadataSize = group.max.metadataSize;
            const maxPayloadSize = group.max.payloadSize;
            const maxObjectCount = group.max.objectCount;
            const maxUploadCount = group.max.uploadCount;
            rows.push({ date, bucketName, maxMetadataSize, maxPayloadSize, maxObjectCount, maxUploadCount });
        }
    }
    return { info: { fetchMillis, cost, budget }, rows };
}

//#endregion

//#region GetR2OperationsByDate

export interface GetR2OperationsByDateRow {
    readonly date: string,
    readonly bucketName: string,
    readonly sumSuccessfulRequests: number,
    readonly sumSuccessfulResponseObjectSize: number,
}

export type R2OperationClass = 'A' | 'B';

async function _getR2OperationsByDate(profile: Profile, operationClass: R2OperationClass, startDateInclusive: string, endDateInclusive: string): Promise<CfGqlResult<GetR2OperationsByDateRow>> {
    const actionTypes = operationClass === 'A' ? [ 'ListBuckets', 'PutBucket', 'ListObjects', 'PutObject', 'CopyObject', 'CompleteMultipartUpload', 'CreateMultipartUpload', 'UploadPartCopy']
        : [ 'HeadBucket', 'HeadObject', 'GetObject' ];
    const resObj = await query(profile, q => q.object('r2OperationsAdaptiveGroups')
        .argLong('limit', 10000)
        .argRaw('filter', `{date_geq: $start, date_leq: $end, actionStatus: "success", actionType_in: ${JSON.stringify(actionTypes)}}`)
        .argRaw('orderBy', `[date_ASC]`)
        .object('dimensions')
            .scalar('date')
            .scalar('bucketName')
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
                    r2OperationsAdaptiveGroups: {
                        dimensions: {
                            date: string,
                            bucketName: string,
                        },
                        sum: {
                            requests: number, // Sum of Requests
                            responseObjectSize: number; // Sum of Response Object Sizes
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
    const rows: GetR2OperationsByDateRow[] = [];
    for (const account of res.data.viewer.accounts) {
        checkEqual('account.accountTag', account.accountTag, profile.accountId);
        for (const group of account.r2OperationsAdaptiveGroups) {
            const date = group.dimensions.date;
            const bucketName = group.dimensions.bucketName;
            const sumSuccessfulRequests = group.sum.requests;
            const sumSuccessfulResponseObjectSize = group.sum.responseObjectSize;
            rows.push({ date, bucketName, sumSuccessfulRequests, sumSuccessfulResponseObjectSize });
        }
    }
    return { info: { fetchMillis, cost, budget }, rows };
}

//#endregion
