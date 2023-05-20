import { KVListCompleteResult, KVListIncompleteResult } from './cloudflare_workers_types.d.ts';

//#region Durable objects

export async function listDurableObjectsNamespaces(opts: { accountId: string, apiToken: string }): Promise<readonly DurableObjectsNamespace[]> {
    const { accountId, apiToken } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/durable_objects/namespaces`;
    return (await execute<readonly DurableObjectsNamespace[]>('listDurableObjectsNamespaces', 'GET', url, apiToken)).result;
}

export async function createDurableObjectsNamespace(opts: { accountId: string, apiToken: string, name: string, script?: string, className?: string }): Promise<DurableObjectsNamespace> {
    const { accountId, apiToken, name, script, className } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/durable_objects/namespaces`;
    return (await execute<DurableObjectsNamespace>('createDurableObjectsNamespace', 'POST', url, apiToken, { name, script, class: className })).result;
}

export async function updateDurableObjectsNamespace(opts: { accountId: string, apiToken: string, id: string, name?: string, script?: string, className?: string }): Promise<DurableObjectsNamespace> {
    const { accountId, apiToken, id, name, script, className } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/durable_objects/namespaces/${id}`;
    return (await execute<DurableObjectsNamespace>('updateDurableObjectsNamespace', 'PUT', url, apiToken, { id, name, script, class: className })).result;
}

export async function deleteDurableObjectsNamespace(opts: { accountId: string, apiToken: string, namespaceId: string }): Promise<void> {
    const { accountId, apiToken, namespaceId } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/durable_objects/namespaces/${namespaceId}`;
    await execute('deleteDurableObjectsNamespace', 'DELETE', url, apiToken);
}

export interface DurableObjectsNamespace {
    readonly id: string;
    readonly name: string;
    readonly script: string | null;
    readonly class: string | undefined;
}

export async function listDurableObjects(opts: { accountId: string, namespaceId: string, apiToken: string, limit?: number, cursor?: string }): Promise<{ objects: readonly DurableObject[], cursor?: string }> {
    const { accountId, namespaceId, apiToken, limit, cursor } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/workers/durable_objects/namespaces/${namespaceId}/objects`);
    if (typeof limit === 'number') url.searchParams.set('limit', String(limit));
    if (typeof cursor === 'string') url.searchParams.set('cursor', cursor);
    const { result, result_info } = await execute('listDurableObjects', 'GET', url.toString(), apiToken) as ListDurableObjectsResponse;
    const resultCursor = result_info.cursor !== '' ? result_info.cursor : undefined;
    return { objects: result, cursor: resultCursor };
}

export interface ListDurableObjectsResponse extends CloudflareApiResponse<readonly DurableObject[]> {
    readonly result: readonly DurableObject[];
    readonly result_info: {
        readonly count: number;
        readonly cursor: string;
    }
}

export interface DurableObject {
    readonly id: string;
    readonly hasStorageData: boolean;
}

//#endregion

//#region Worker scripts

export async function listScripts(opts: { accountId: string, apiToken: string }): Promise<readonly Script[]> {
    const { accountId, apiToken } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts`;
    return (await execute<readonly Script[]>('listScripts', 'GET', url, apiToken)).result;
}

export async function putScript(opts: { accountId: string, scriptName: string, apiToken: string, scriptContents: Uint8Array, bindings?: Binding[], migrations?: Migrations, parts?: Part[], isModule: boolean, usageModel?: 'bundled' | 'unbound', logpush?: boolean, compatibilityDate?: string, compatibilityFlags?: string[] }): Promise<Script> {
    const { accountId, scriptName, apiToken, scriptContents, bindings, migrations, parts, isModule, usageModel, logpush, compatibilityDate, compatibilityFlags } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}`;
    const formData = new FormData();
    const metadata: Record<string, unknown> = { 
        bindings, 
        usage_model: usageModel,
        migrations,
        logpush,
        compatibility_date: compatibilityDate,
        compatibility_flags: compatibilityFlags,
    };

    if (isModule) {
        metadata['main_module'] = 'main';
    } else {
        metadata['body_part'] = 'script';   
    }
    if (CloudflareApi.DEBUG) console.log('metadata', JSON.stringify(metadata, undefined, 2));
    const metadataBlob = new Blob([ JSON.stringify(metadata) ], { type: APPLICATION_JSON });
    formData.set('metadata', metadataBlob);
    if (isModule) {
        const scriptBlob = new Blob([ scriptContents.buffer ], { type: 'application/javascript+module' });
        formData.set('script', scriptBlob, 'main');
    } else {
        const scriptBlob = new Blob([ scriptContents.buffer ], { type: 'application/javascript' });
        formData.set('script', scriptBlob);
    }
   
    for (const { name, value, fileName } of (parts || [])) {
        formData.set(name, value, fileName);
    }
    return (await execute<Script>('putScript', 'PUT', url, apiToken, formData)).result;
}

export type Binding = PlainTextBinding | SecretTextBinding | KvNamespaceBinding | DurableObjectNamespaceBinding | WasmModuleBinding | ServiceBinding | R2BucketBinding | AnalyticsEngineBinding | D1DatabaseBinding | QueueBinding | SecretKeyBinding;

export interface PlainTextBinding {
    readonly type: 'plain_text';
    readonly name: string;
    readonly text: string;
}

export interface SecretTextBinding {
    readonly type: 'secret_text';
    readonly name: string;
    readonly text: string;
}

export interface KvNamespaceBinding {
    readonly type: 'kv_namespace';
    readonly name: string;
    readonly 'namespace_id': string;
}

export interface DurableObjectNamespaceBinding {
    readonly type: 'durable_object_namespace';
    readonly name: string;
    readonly 'namespace_id': string;
}

export interface WasmModuleBinding {
    readonly type: 'wasm_module';
    readonly name: string;
    readonly part: string;
}

export interface ServiceBinding {
    readonly type: 'service';
    readonly name: string;
    readonly service: string;
    readonly environment: string;
}

export interface R2BucketBinding {
    readonly type: 'r2_bucket';
    readonly name: string;
    readonly 'bucket_name': string;
}

export interface AnalyticsEngineBinding {
    readonly type: 'analytics_engine';
    readonly name: string;
    readonly dataset: string;
}

export interface D1DatabaseBinding {
    readonly type: 'd1';
    readonly name: string;
    readonly id: string;
}

export interface QueueBinding {
    readonly type: 'queue';
    readonly name: string;
    readonly 'queue_name': string;
}

export interface SecretKeyBinding {
    readonly type: 'secret_key';
    readonly name: string;
    readonly format: string;
    readonly algorithm: AesKeyGenParams | HmacKeyGenParams;
    readonly usages: KeyUsage[];
    readonly key_base64: string;
}

// this is likely not correct, but it works to delete obsolete DO classes at least
export interface Migrations {
    readonly tag: string;
    readonly deleted_classes: string[];
}

export interface Part {
    readonly name: string;
    readonly value: string | Blob;
    readonly fileName?: string;
    readonly valueBytes?: Uint8Array;
}

export async function deleteScript(opts: { accountId: string, scriptName: string, apiToken: string }): Promise<DeleteScriptResult> {
    const { accountId, apiToken, scriptName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}`;
    return (await execute<DeleteScriptResult>('deleteScript', 'DELETE', url, apiToken)).result;
}

export interface DeleteScriptResult {
    readonly id: string;
}

export interface Script {
    readonly id: string;
    readonly tag: string;
    readonly etag: string;
    readonly handlers: readonly string[];
    readonly 'named_handlers'?: readonly NamedHandler[];
    readonly 'modified_on': string;
    readonly 'created_on': string;
    readonly 'usage_model': string;
    readonly 'last_deployed_from': string;
}

export interface NamedHandler {
    readonly name: string;
    readonly handlers: readonly string[];
}

//#endregion

//#region Worker Deployments

export async function listWorkerDeployments(opts: { accountId: string, apiToken: string, scriptTag: string }): Promise<WorkerDeploymentResult> {
    const { accountId, apiToken, scriptTag } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/deployments/by-script/${scriptTag}`;
    return (await execute<WorkerDeploymentResult>('listWorkerDeployments', 'GET', url, apiToken)).result;
}

export interface WorkerDeploymentResult {
    readonly latest: WorkerDeployment;
    readonly items: readonly WorkerDeploymentSummary[];
}

export interface WorkerDeployment extends WorkerDeploymentSummary {
    readonly resources: WorkerDeployment;
}

export interface WorkerDeploymentResources {
    readonly script: { readonly etag: string, readonly handlers: readonly string[], readonly named_handlers?: readonly NamedHandler[], readonly last_deployed_from: string };
    readonly script_runtime: { readonly usage_model: string };
    readonly bindings: readonly (Record<string, unknown> & { name: string, type: string })[];
}

export interface WorkerDeploymentSummary {
    readonly id: string; // e.g. a5adf92c-7513-4011-ac1a-78a903c2cc0a
    readonly number: number; // e.g. 4
    readonly metadata: WorkerDeploymentMetadata;
}

export interface WorkerDeploymentMetadata {
    readonly created_on: string; // e.g. 2022-10-24T23:52:40.183869Z
    readonly modified_on: string;
    readonly source: string; // 'api' | 'dash' | 'wrangler' | 'terraform' | 'other'
    readonly author: string; // cloudflare tag (for what entity?)
    readonly author_email: string; // email address
}

//#endregion

//#region Workers Subdomain

export async function getWorkersSubdomain(opts: { accountId: string, apiToken: string }): Promise<string> {
    const { accountId, apiToken } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/subdomain`;
    return (await execute<WorkersSubdomainResult>('getWorkersSubdomain', 'GET', url, apiToken)).result.subdomain;
}

export interface WorkersSubdomainResult {
    readonly subdomain: string;
}

//#endregion

//#region Worker Account Settings

export async function getWorkerAccountSettings(opts: { accountId: string, apiToken: string }): Promise<WorkerAccountSettings> {
    const { accountId, apiToken } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/account-settings`;
    return (await execute<WorkerAccountSettings>('getWorkerAccountSettings', 'GET', url, apiToken)).result;
}

export async function putWorkerAccountSettings(opts: { accountId: string, apiToken: string, defaultUsageModel: 'bundled' | 'unbound' }): Promise<WorkerAccountSettings> {
    const { accountId, apiToken, defaultUsageModel: default_usage_model } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/account-settings`;
    return (await execute<WorkerAccountSettings>('putWorkerAccountSettings', 'PUT', url, apiToken, { default_usage_model })).result;
}

export interface WorkerAccountSettings {
    readonly 'default_usage_model': string,
    readonly 'green_compute': boolean,
}

//#endregion

//#region Worker Service Metadata

export async function getWorkerServiceMetadata(opts: { accountId: string, apiToken: string, scriptName: string }): Promise<WorkerServiceMetadata> {
    const { accountId, apiToken, scriptName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/services/${scriptName}`;
    return (await execute<WorkerServiceMetadata>('getWorkerServiceMetadata', 'GET', url, apiToken)).result;
}

export interface WorkerServiceMetadata {
    readonly id: string; // script id/name
    readonly default_environment: WorkerServiceEnvironment;
    readonly created_on: string;
    readonly modified_on: string;
    readonly usage_model: string;
    readonly environments: readonly WorkerServiceEnvironmentSummary[];
}

export interface WorkerServiceEnvironmentSummary {
    readonly environment: string; // e.g. production
    readonly created_on: string;
    readonly modified_on: string;
}

export interface WorkerServiceEnvironment extends WorkerServiceEnvironmentSummary {
    readonly script: Script;
}

//#endregion

//#region Worker Service Subdomain Enabled

export async function getWorkerServiceSubdomainEnabled(opts: { accountId: string, apiToken: string, scriptName: string, environment?: string }): Promise<boolean> {
    const { accountId, apiToken, scriptName, environment = 'production' } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/services/${scriptName}/environments/${environment}/subdomain`;
    return (await execute<{ enabled: boolean }>('getWorkerServiceSubdomainEnabled', 'GET', url, apiToken)).result.enabled;
}

export async function setWorkerServiceSubdomainEnabled(opts: { accountId: string, apiToken: string, scriptName: string, environment?: string, enabled: boolean }): Promise<void> {
    const { accountId, apiToken, scriptName, environment = 'production', enabled } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/services/${scriptName}/environments/${environment}/subdomain`;
    await execute('setWorkerServiceSubdomainEnabled', 'POST', url, apiToken, { enabled });
    // result: null
}

//#endregion

//#region Workers KV

export async function getKeyValue(opts: { accountId: string, namespaceId: string, key: string, apiToken: string }): Promise<Uint8Array | undefined> {
    const { accountId, apiToken, namespaceId, key } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/storage/kv/namespaces/${namespaceId}/values/${key}`;
    return await execute('getKeyValue', 'GET', url, apiToken, undefined, 'bytes?');
}

export async function getKeyMetadata(accountId: string, namespaceId: string, key: string, apiToken: string): Promise<Record<string, string> | undefined> {
    const url = `${computeAccountBaseUrl(accountId)}/storage/kv/namespaces/${namespaceId}/metadata/${key}`;
    const res = await execute<Record<string, string>>('getKeyMetadata', 'GET', url, apiToken, undefined, 'json?');
    return res?.result;
}

/**
 * Write key-value pair
 * https://api.cloudflare.com/#workers-kv-namespace-write-key-value-pair
 * 
 * Write key-value pair with metadata
 * https://api.cloudflare.com/#workers-kv-namespace-write-key-value-pair-with-metadata
 */
export async function putKeyValue(opts: { accountId: string, namespaceId: string, key: string, value: string, apiToken: string, expiration?: number, expirationTtl?: number, metadata?: Record<string, unknown> }) {
    const { accountId, namespaceId, key, value, apiToken, expiration, expirationTtl, metadata } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/storage/kv/namespaces/${namespaceId}/values/${key}`);
    if (typeof expiration === 'number') url.searchParams.set('expiration', expiration.toString());
    if (typeof expirationTtl === 'number') url.searchParams.set('expirationTtl', expirationTtl.toString());

    if (isStringRecord(metadata) && Object.keys(metadata).length > 0) {
        const form = new FormData();
        form.set('value', value);
        form.set('metadata', JSON.stringify(metadata));
        await execute('putKeyValueWithMetadata', 'PUT', url.toString(), apiToken, form);
    } else {
        await execute('putKeyValue', 'PUT', url.toString(), apiToken, value);
    }
}

/**
 * Delete key-value pair
 * https://developers.cloudflare.com/api/operations/workers-kv-namespace-delete-key-value-pair
 */
export async function deleteKeyValue(opts: { accountId: string, namespaceId: string, key: string, apiToken: string }): Promise<void> {
    const { accountId, namespaceId, key, apiToken } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/storage/kv/namespaces/${namespaceId}/values/${key}`);

    await execute('deleteKeyValue', 'DELETE', url.toString(), apiToken);
}
  
/**
 * List a namespace's keys
 * https://developers.cloudflare.com/api/operations/workers-kv-namespace-list-a-namespace'-s-keys
 */
export async function listKeys(opts: { accountId: string, namespaceId: string, apiToken: string, cursor?: string, limit?: number, prefix?: string }) {
    const { accountId, namespaceId, apiToken, cursor, limit, prefix } = opts;

    const url = new URL(`${computeAccountBaseUrl(accountId)}/storage/kv/namespaces/${namespaceId}/keys`);

    if (typeof limit === 'number') url.searchParams.set('limit', limit.toString());
    if (cursor) url.searchParams.set('cursor', cursor);
    if (prefix) url.searchParams.set('prefix', prefix);

    return (await execute<KVListCompleteResult | KVListIncompleteResult>('listKeys', 'GET', url.toString(), apiToken)).result;
}

//#endregion

//#region Workers Tails

/**
 * List Tails
 * Lists all active Tail sessions for a given Worker
 * https://api.cloudflare.com/#worker-tails-list-tails
 */
export async function listTails(opts: { accountId: string, scriptName: string, apiToken: string }): Promise<readonly Tail[]> {
    const { accountId, apiToken, scriptName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}/tails`;
    return (await execute<readonly Tail[]>('listTails', 'GET', url, apiToken)).result;
}

/**
 * Create Tail
 * https://api.cloudflare.com/#worker-create-tail
 * 
 * Constrained to at most one tail per script
 */
export async function createTail(opts: { accountId: string, scriptName: string, apiToken: string }): Promise<Tail> {
    const { accountId, apiToken, scriptName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}/tails`;
    return (await execute<Tail>('createTail', 'POST', url, apiToken)).result;
}

/**
 * Send Tail Heartbeat
 * https://api.cloudflare.com/#worker-tail-heartbeat
 */
export async function sendTailHeartbeat(opts: { accountId: string, scriptName: string, tailId: string, apiToken: string }): Promise<Tail> {
    const { accountId, apiToken, scriptName, tailId } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}/tails/${tailId}/heartbeat`;
    return (await execute<Tail>('sendTailHeartbeat', 'POST', url, apiToken)).result;
}

/**
 * Delete Tail
 * https://api.cloudflare.com/#worker-delete-tail
 */
export async function deleteTail(opts: { accountId: string, scriptName: string, tailId: string, apiToken: string }): Promise<void> {
    const { accountId, apiToken, scriptName, tailId } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}/tails/${tailId}`;
    await execute('deleteTail', 'DELETE', url, apiToken); // result = null
}

export interface Tail {
    readonly id: string; // cf id
    readonly url: string // e.g. wss://tail.developers.workers.dev/<tail-id>
    readonly 'expires_at': string; // e.g. 2021-08-20T23:45:17Z  (4-6 hrs from creation)
}

//#endregion

//#region R2

/**
 * List R2 Buckets
 */
export async function listR2Buckets(opts: { accountId: string, apiToken: string }): Promise<readonly Bucket[]> {
    const { accountId, apiToken } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/r2/buckets`;
    return (await execute<ListR2BucketsResult>('listR2Buckets', 'GET', url, apiToken)).result.buckets;
}

export interface ListR2BucketsResult {
    readonly buckets: readonly Bucket[];
}

export interface Bucket {
    readonly name: string;
    readonly creation_date: string;
}

/**
 * Create R2 Bucket
 * 
 * @throws if exists and owned: 409 10004 The bucket you tried to create already exists, and you own it.
 */
export async function createR2Bucket(opts: { accountId: string, bucketName: string, apiToken: string }): Promise<void> {
    const { accountId, apiToken, bucketName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/r2/buckets/${bucketName}`;
    await execute('createR2Bucket', 'PUT', url, apiToken);
    // result is: {}
}

/**
 * Delete R2 Bucket
 * 
 * @throws if not exists: 404 10006 The specified bucket does not exist.
 */
export async function deleteR2Bucket(opts: { accountId: string, bucketName: string, apiToken: string }): Promise<void> {
    const { accountId, apiToken, bucketName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/r2/buckets/${bucketName}`;
    await execute('deleteR2Bucket', 'DELETE', url, apiToken);
    // result is: {}
}

/**
 * Get R2 Bucket usage summary
 * 
 * @throws if not exists: 404 10006 The specified bucket does not exist.
 */
 export async function getR2BucketUsageSummary(opts: { accountId: string, bucketName: string, apiToken: string }): Promise<R2BucketUsageSummary> {
    const { accountId, apiToken, bucketName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/r2/buckets/${bucketName}/usage`;
    return (await execute<R2BucketUsageSummary>('getR2BucketUsageSummary', 'GET', url, apiToken)).result;
}

export interface R2BucketUsageSummary {
    readonly end: string; // e.g. 2022-07-24T18:43:18.855Z
    readonly payloadSize: string; // e.g. 1269928930
    readonly metadataSize: string; // e.g. 340
    readonly objectCount: string; // e.g. 26
    readonly uploadCount: string // e.g. 0
}

//#endregion

//#region Flags

/**
 * List Account Flags
 */
export async function listFlags(opts: { accountId: string, apiToken: string }): Promise<FlagsResult> {
    const { accountId, apiToken } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/flags`;
    return (await execute<FlagsResult>('listFlags', 'GET', url, apiToken)).result;
}

export type FlagsResult = Record<string, Record<string, unknown>>;

//#endregion

//#region Workers Domains

export async function listWorkersDomains(opts: { accountId: string, apiToken: string, hostname?: string }): Promise<readonly WorkersDomain[]> {
    const { accountId, apiToken, hostname } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/workers/domains`);
    if (hostname) url.searchParams.set('hostname', hostname);
    return (await execute<readonly WorkersDomain[]>('listWorkersDomains', 'GET', url.toString(), apiToken)).result;
}

export async function putWorkersDomain(opts: { accountId: string, apiToken: string, hostname: string, zoneId: string, service: string, environment: string }): Promise<WorkersDomain> {
    const { accountId, apiToken, hostname, zoneId, service, environment } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/workers/domains`);

    return (await execute<WorkersDomain>('putWorkersDomain', 'PUT', url.toString(), apiToken, { hostname, zone_id: zoneId, service, environment })).result;
}

export async function deleteWorkersDomain(opts: { accountId: string, apiToken: string, workersDomainId: string }): Promise<void> {
    const { accountId, apiToken, workersDomainId } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/domains/${workersDomainId}`;

    await execute('deleteWorkersDomain', 'DELETE', url, apiToken, undefined, 'empty');
}

export interface WorkersDomain {
    readonly id: string;
    readonly zone_id: string;
    readonly zone_name: string;
    readonly hostname: string;
    readonly service: string;
    readonly environment: string;
}

//#endregion

//#region Zones

export interface ListZonesOpts {

    /**
     * Whether to match all search requirements or at least one (any)
     * 
     * default: all
     */
    readonly match?: 'any' | 'all';

    /**
     * A domain name
     * 
     * max length: 253
     */
    readonly name?: string;

    /**
     * Field to order zones by
     * 
     * valid values: name, status, account.id, account.name
     */
    readonly order?: 'name' | 'status' | 'account.id' | 'account.name';

    /**
     * Page number of paginated results
     * 
     * default value: 1
     * min value:1
     */
    readonly page?: number;

    /**
     * Number of zones per page
     * 
     * default value: 20
     * min value:5
     * max value:50 (found max value:1000)
     */
    readonly perPage?: number;

    /** Status of the zone */
    readonly status?: ZoneStatus;

    /** Direction to order zones */
    readonly direction?: 'asc' | 'desc';
}

export async function listZones(opts: { accountId: string, apiToken: string } & ListZonesOpts) {
    const { accountId, apiToken, match, name, order, page, perPage, status, direction } = opts;
    const url = new URL(`${computeBaseUrl()}/zones`);
    url.searchParams.set('account.id', accountId);
    if (match) url.searchParams.set('match', match);
    if (name) url.searchParams.set('name', name);
    if (order) url.searchParams.set('order', order);
    if (page) url.searchParams.set('page', String(page));
    if (perPage) url.searchParams.set('per_page', String(perPage));
    if (status) url.searchParams.set('status', status);
    if (direction) url.searchParams.set('direction', direction);
    return (await execute('listZones', 'GET', url.toString(), apiToken) as ListZonesResponse).result;
}

export interface ListZonesResponse extends CloudflareApiResponse<readonly Zone[]> {
    readonly result_info: ResultInfo;
}

export type ZoneStatus = 'active' | 'pending' | 'initializing' | 'moved' | 'deleted' | 'deactivated' | 'read only';

export interface Zone {
    /**
     * Zone identifier tag
     * 
     * max length: 32
     * read only
     */
    readonly id: string;

    /**
     * The domain name
     * 
     * max length: 253
     * read only
     * pattern: ^([a-zA-Z0-9][\-a-zA-Z0-9]*\.)+[\-a-zA-Z0-9]{2,20}$
     */
    readonly name: string;

    /**
     * Status of the zone
     */
    readonly status: ZoneStatus;

    /**
     * Indicates if the zone is only using Cloudflare DNS services. A true value means the zone will not receive security or performance benefits.
     * 
     * default value: false
     * read only
     */
    readonly paused: boolean;

    /**
     * A full zone implies that DNS is hosted with Cloudflare. A partial zone is typically a partner-hosted zone or a CNAME setup.
     */
    readonly type: 'full' | 'partial';

    /**
     * The interval (in seconds) from when development mode expires (positive integer) or last expired (negative integer) for the domain. If development mode has never been enabled, this value is 0.
     * 
     * read only
     */
    readonly development_mode: number;

    // TODO others as needed
}

//#endregion

//#region Verify Token

export async function verifyToken(opts: { apiToken: string }): Promise<VerifyTokenResult> {
    const { apiToken } = opts;
    const url = `${computeBaseUrl()}/user/tokens/verify`;
    return (await execute<VerifyTokenResult>('verifyToken', 'GET', url, apiToken)).result;
}

export interface VerifyTokenResult {
    readonly id: string;
    readonly status: string; // e.g. active
}

//#endregion

//#region Memberships

export interface ListMembershipsOpts {

    /** Status of this membership */
    readonly status?: MembershipStatus;

    /** 
     * Account name
     * 
     * max length: 100
     */
    readonly accountName?: string;

    /**
     * Field to order zones by
     * 
     * valid values: name, status, account.id, account.name
     */
    readonly order?: 'id' | 'status' | 'account.name';

    /**
     * Page number of paginated results
     * 
     * default value: 1
     * min value:1
     */
    readonly page?: number;

    /**
     * Number of memberships per page
     * 
     * default value: 20
     * min value:5
     * max value:50 (found max value:1000)
     */
    readonly perPage?: number;

    /** Direction to order zones */
    readonly direction?: 'asc' | 'desc';
}

export async function listMemberships(opts: { apiToken: string } & ListMembershipsOpts) {
    const { apiToken, status, accountName, order, page, perPage, direction } = opts;
    const url = new URL(`${computeBaseUrl()}/memberships`);
    if (status) url.searchParams.set('status', status);
    if (accountName) url.searchParams.set('account.name', accountName);
    if (order) url.searchParams.set('order', order);
    if (page) url.searchParams.set('page', String(page));
    if (perPage) url.searchParams.set('per_page', String(perPage));
    if (direction) url.searchParams.set('direction', direction);
    return (await execute('listMemberships', 'GET', url.toString(), apiToken) as ListMembershipsResponse).result;
}

export interface ListMembershipsResponse extends CloudflareApiResponse<readonly Membership[]> {
    readonly result_info: ResultInfo;
}

export type MembershipStatus = 'accepted' | 'pending' | 'rejected';

export interface Membership {
    /** 
     * Membership identifier tag
     * 
     * max length: 32
     * read only
     */
    readonly id: string;

    /**
     * The unique activation code for the account membership
     * 
     * max length: 64
     * read only
     */
    readonly code: string;

    /** Status of this membership */
    readonly status: MembershipStatus;

    readonly account: Account;

    /** List of role names for the User at the Account */
    readonly roles: readonly string[];

    // e.g. { "analytics": { "read": true, "write": true } }
    readonly permissions: Record<string, unknown>;
}

//#endregion

//#region Accounts

export interface ListAccountsOpts {

    /** Name of the account */
    readonly name?: string;

    /**
     * Page number of paginated results
     * 
     * default value: 1
     * min value:1
     */
    readonly page?: number;

    /**
     * Number of memberships per page
     * 
     * default value: 20
     * min value:5
     * max value:50 (found max value:1000)
     */
    readonly perPage?: number;

    /** Direction to order zones */
    readonly direction?: 'asc' | 'desc';
}

export async function listAccounts(opts: { apiToken: string } & ListAccountsOpts) {
    const { apiToken, name, page, perPage, direction } = opts;
    const url = new URL(`${computeBaseUrl()}/accounts`);
    if (name) url.searchParams.set('name', name);
    if (page) url.searchParams.set('page', String(page));
    if (perPage) url.searchParams.set('per_page', String(perPage));
    if (direction) url.searchParams.set('direction', direction);
    return (await execute('listAccounts', 'GET', url.toString(), apiToken) as ListAccountsResponse).result;
}

export interface ListAccountsResponse extends CloudflareApiResponse<readonly Account[]> {
    readonly result_info: ResultInfo;
}

export interface Account {
    /**
     * Account identifier tag
     * 
     * max length: 32
     * read only
     */
    readonly id: string;

    /**
     * Account name
     * 
     * max length: 100
     * read only
     */
    readonly name: string;

    /** Account settings */
    readonly settings: Record<string, unknown>;

    /** Describes when account was created */
    readonly created_on: string; // instant
}

//#endregion

//#region User

export async function getUser(opts: { apiToken: string }): Promise<User> {
    const { apiToken } = opts;
    const url = `${computeBaseUrl()}/user`;
    return (await execute<User>('getUser', 'GET', url, apiToken)).result;
}

export interface User {
    /**
     * User identifier tag
     * 
     * max length: 32
     * read only
     */
    readonly id: string;

    /**
     * Your contact email address
     * 
     * max length: 90
     */
    readonly email: string;

    readonly has_pro_zones: boolean;
    readonly has_business_zones: boolean;
    readonly has_enterprise_zones: boolean;

    /** Indicates whether the user is prevented from performing certain actions within their account */
    readonly suspended: boolean;

    // TODO as needed
}

//#endregion

//#region Pub/Sub

export async function listPubsubNamespaces(opts: { accountId: string, apiToken: string }): Promise<readonly PubsubNamespace[]> {
    const { accountId, apiToken } = opts;
    const url = `${computeBaseUrl()}/accounts/${accountId}/pubsub/namespaces`;
    return (await execute<readonly PubsubNamespace[]>('listPubsubNamespaces', 'GET', url, apiToken)).result;
}

export async function createPubsubNamespace(opts: { accountId: string, apiToken: string, name: string }): Promise<PubsubNamespace> {
    const { accountId, apiToken, name } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/pubsub/namespaces`;
    return (await execute<PubsubNamespace>('createPubsubNamespace', 'POST', url, apiToken, { name })).result;
}

export interface PubsubNamespace {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly created_on: string;
    readonly modified_on: string;
}

export async function deletePubsubNamespace(opts: { accountId: string, apiToken: string, namespaceName: string }): Promise<void> {
    const { accountId, apiToken, namespaceName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/pubsub/namespaces/${namespaceName}`;
    await execute('deletePubsubNamespace', 'DELETE', url, apiToken);
    // 200, result = null
}

export async function listPubsubBrokers(opts: { accountId: string, apiToken: string, namespaceName: string }): Promise<readonly PubsubBroker[]> {
    const { accountId, apiToken, namespaceName } = opts;
    const url = `${computeBaseUrl()}/accounts/${accountId}/pubsub/namespaces/${namespaceName}/brokers`;
    return (await execute<readonly PubsubBroker[]>('listPubsubBrokers', 'GET', url, apiToken)).result;
}

export interface PubsubBroker {
    readonly id: string;
    readonly name: string;
    readonly auth_type: string; // TOKEN
    readonly created_on: string;
    readonly modified_on: string;
    readonly expiration: null;
    readonly endpoint: string; // mqtts://<broker-name>.<namespace-name>.cloudflarepubsub.com:8883
    readonly on_publish?: { url: string };
}

export async function createPubsubBroker(opts: { accountId: string, apiToken: string, namespaceName: string, brokerName: string, authType: string }): Promise<PubsubBroker> {
    const { accountId, apiToken, namespaceName, brokerName, authType } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/pubsub/namespaces/${namespaceName}/brokers`;
    return (await execute<PubsubBroker>('createPubsubBroker', 'POST', url, apiToken, { name: brokerName, authType })).result;
}

export async function updatePubsubBroker(opts: { accountId: string, apiToken: string, namespaceName: string, brokerName: string, expiration?: number | null, onPublishUrl?: string | null }): Promise<void> {
    const { accountId, apiToken, namespaceName, brokerName, expiration, onPublishUrl } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/pubsub/namespaces/${namespaceName}/brokers/${brokerName}`;
    const payload: Record<string, unknown> = {};
    if (expiration !== undefined) payload.expiration = expiration;
    if (onPublishUrl === null || typeof onPublishUrl === 'string') payload.on_publish = { url: onPublishUrl };
    await execute('updatePubsubBroker', 'PATCH', url.toString(), apiToken, payload);
}

export async function listPubsubBrokerPublicKeys(opts: { accountId: string, apiToken: string, namespaceName: string, brokerName: string }): Promise<PubsubBrokerPublicKeys> {
    const { accountId, apiToken, namespaceName, brokerName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/pubsub/namespaces/${namespaceName}/brokers/${brokerName}/publickeys`;
    return (await execute<PubsubBrokerPublicKeys>('listPubsubBrokerPublicKeys', 'GET', url, apiToken)).result;
}

export interface PubsubBrokerPublicKeys {
    readonly keys: Record<string, string>[];
}

export async function getPubsubBroker(opts: { accountId: string, apiToken: string, namespaceName: string, brokerName: string }): Promise<PubsubBroker> {
    const { accountId, apiToken, namespaceName, brokerName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/pubsub/namespaces/${namespaceName}/brokers/${brokerName}`;
    return (await execute<PubsubBroker>('getPubsubBroker', 'GET', url, apiToken)).result;
}

export async function deletePubsubBroker(opts: { accountId: string, apiToken: string, namespaceName: string, brokerName: string }): Promise<void> {
    const { accountId, apiToken, namespaceName, brokerName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/pubsub/namespaces/${namespaceName}/brokers/${brokerName}`;
    await execute('deletePubsubBroker', 'DELETE', url, apiToken);
    // 200, result = null
}

export async function generatePubsubCredentials(opts: { accountId: string, apiToken: string, namespaceName: string, brokerName: string, number: number, type: string, topicAcl: string, clientIds?: string[], expiration?: number }): Promise<Record<string, string>> {
    const { accountId, apiToken, namespaceName, brokerName, number, type, topicAcl, clientIds, expiration } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/pubsub/namespaces/${namespaceName}/brokers/${brokerName}/credentials`);
    url.searchParams.set('number', String(number));
    url.searchParams.set('type', type);
    url.searchParams.set('topicAcl', topicAcl);
    if (typeof expiration === 'number') url.searchParams.set('expiration', String(expiration));
    (clientIds ?? []).forEach(v => url.searchParams.append('clientid', v));
    return (await execute<Record<string, string>>('generatePubsubCredentials', 'GET', url.toString(), apiToken)).result;
}

export async function revokePubsubCredentials(opts: { accountId: string, apiToken: string, namespaceName: string, brokerName: string, jwtIds: string[] }): Promise<void> {
    const { accountId, apiToken, namespaceName, brokerName, jwtIds } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/pubsub/namespaces/${namespaceName}/brokers/${brokerName}/revocations`);
    if (jwtIds.length === 0) throw new Error(`Must include at least one JWT id to revoke`);
    url.searchParams.set('jti', jwtIds.join(','));
    await execute('revokePubsubCredentials', 'POST', url.toString(), apiToken);
    // 200, result = null
}

export async function listPubsubRevocations(opts: { accountId: string, apiToken: string, namespaceName: string, brokerName: string }): Promise<readonly string[]> { // jwt ids
    const { accountId, apiToken, namespaceName, brokerName } = opts;
    const url = `${computeBaseUrl()}/accounts/${accountId}/pubsub/namespaces/${namespaceName}/brokers/${brokerName}/revocations`;
    return (await execute<readonly string[]>('listPubsubRevocations', 'GET', url, apiToken)).result;
}

export async function deletePubsubRevocations(opts: { accountId: string, apiToken: string, namespaceName: string, brokerName: string, jwtIds: string[] }): Promise<void> {
    const { accountId, apiToken, namespaceName, brokerName, jwtIds } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/pubsub/namespaces/${namespaceName}/brokers/${brokerName}/revocations`);
    url.searchParams.set('jti', jwtIds.join(','));
    await execute('deletePubsubRevocations', 'DELETE', url.toString(), apiToken);
    // 200, result = null
}

//#endregion

//#region Analytics Engine

export async function queryAnalyticsEngine(opts: { accountId: string, apiToken: string, query: string }): Promise<string> {
    const { accountId, apiToken, query } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/analytics_engine/sql`;
    return await execute('queryAnalyticsEngine', 'POST', url, apiToken, query, 'text');
}

//#endregion

//#region D1

export async function createD1Database(opts: { accountId: string, apiToken: string, databaseName: string }): Promise<D1Database> {
    const { accountId, apiToken, databaseName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/d1/database`;
    return (await execute<D1Database>('createD1Database', 'POST', url, apiToken, { name: databaseName })).result;
}

export async function listD1Databases(opts: { accountId: string, apiToken: string }): Promise<readonly D1Database[]> {
    const { accountId, apiToken } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/d1/database`;
    return (await execute('listD1Databases', 'GET', url, apiToken) as ListD1DatabasesResponse).result;
}

export interface ListD1DatabasesResponse extends CloudflareApiResponse<readonly D1Database[]> {
    readonly result_info: ResultInfo;
}

export interface D1Database {
    readonly uuid: string; // dashed v4 guid
    readonly name: string;
}

export async function deleteD1Database(opts: { accountId: string, apiToken: string, databaseUuid: string }): Promise<void> {
    const { accountId, apiToken, databaseUuid } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/d1/database/${databaseUuid}`;
    await execute('deleteD1Database', 'DELETE', url.toString(), apiToken);
    // 200 result: null
}

export async function queryD1Database(opts: { accountId: string, apiToken: string, databaseUuid: string, sql: string, params?: (null | number | string | ArrayBuffer)[] }): Promise<readonly D1QueryResult[]> {
    const { accountId, apiToken, databaseUuid, sql, params = [] } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/d1/database/${databaseUuid}/query`;
    const payload = { sql, params };
    return (await execute<readonly D1QueryResult[]>('queryD1Database', 'POST', url, apiToken, payload)).result;
}

export interface D1QueryResult {
    readonly results: Record<string, unknown>;
    readonly duration: number; // duration of the operation in milliseconds, e.g. 0.04996099999999615
    readonly lastRowId: number | null; // the rowid of the last row inserted or null if it doesn't apply, see https://www.sqlite.org/c3ref/last_insert_rowid.html
    readonly changes: number | null; // total # of rows that were inserted/updated/deleted, or 0 if read-only
    readonly success: boolean;
}

export async function listD1Backups(opts: { accountId: string, apiToken: string, databaseUuid: string }): Promise<readonly D1Backup[]> {
    const { accountId, apiToken, databaseUuid } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/d1/database/${databaseUuid}/backup`);
    // figure out paging
    return (await execute<readonly D1Backup[]>('listD1Backups', 'GET', url.toString(), apiToken)).result;
}

export interface D1Backup {
    readonly id: string; // dashed v4 guid
    readonly database_id: string // dashed v4 guid
    readonly created_at: string; // instant
    readonly state: string; // e.g. done
    readonly num_tables: number;
    readonly file_size: number;
}

export async function createD1Backup(opts: { accountId: string, apiToken: string, databaseUuid: string }): Promise<D1Backup> {
    const { accountId, apiToken, databaseUuid } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/d1/database/${databaseUuid}/backup`;
    return (await execute<D1Backup>('createD1Backup', 'POST', url, apiToken)).result;
}

export async function restoreD1Backup(opts: { accountId: string, apiToken: string, databaseUuid: string, backupUuid: string }): Promise<void> {
    const { accountId, apiToken, databaseUuid, backupUuid } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/d1/database/${databaseUuid}/backup/${backupUuid}/restore`;
    await execute<D1Backup>('restoreD1Backup', 'POST', url, apiToken);
    // result: null
}

export async function downloadD1Backup(opts: { accountId: string, apiToken: string, databaseUuid: string, backupUuid: string }): Promise<Uint8Array> {
    const { accountId, apiToken, databaseUuid, backupUuid } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/d1/database/${databaseUuid}/backup/${backupUuid}/download`;
    return await execute('downloadD1Backup', 'GET', url, apiToken, undefined, 'bytes');
}

//#endregion

//#region Trace workers

export async function listTraceWorkers(opts: { accountId: string, apiToken: string }): Promise<readonly TraceWorker[]> {
    const { accountId, apiToken } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/traces`;
    return (await execute<readonly TraceWorker[]>('listTraceWorkers', 'GET', url, apiToken)).result;
}

export interface TraceWorker {
    readonly tag: string; // cloudflare id
    readonly producer: { readonly script: string };
    readonly consumer: { readonly service: string, readonly environment: string };
    readonly created_on: string; // instant with six digits of fractional seconds
    readonly updated_on: string; // instant with six digits of fractional seconds
}

export async function setTraceWorker(opts: { accountId: string, apiToken: string, producerScript: string, consumerService: string }): Promise<TraceWorker> {
    const { accountId, apiToken, producerScript, consumerService } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/traces`;
    const payload = { producer: { script: producerScript, environment: 'production' }, consumer: { service: consumerService, environment: 'production' } };
    return (await execute<TraceWorker>('setTraceWorker', 'POST', url, apiToken, payload)).result;
}

export async function deleteTraceWorker(opts: { accountId: string, apiToken: string, tag: string }): Promise<void> {
    const { accountId, apiToken, tag } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/traces/${tag}`;
    const res = await execute('deleteTraceWorker', 'DELETE', url.toString(), apiToken);
    console.log(res);
    // 200 result: null
}

//#endregion

//#region Billing

export async function listUserBillingHistory(opts: { apiToken: string }): Promise<unknown> {
    const { apiToken } = opts;
    const url = new URL(`${computeBaseUrl()}/user/billing/history`);
    url.searchParams.set('type', 'charge');
    return (await execute<unknown>('listUserBillingHistory', 'GET', url.toString(), apiToken)).result;
}

//#endregion

//#region Queues

export async function listQueues(opts: { accountId: string, apiToken: string, page?: number }): Promise<Queue[]> {
    const { accountId, apiToken, page } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/workers/queues`);
    if (typeof page === 'number') url.searchParams.set('page', page.toString());
    return (await execute<Queue[]>('listQueues', 'GET', url.toString(), apiToken)).result;
}

export async function getQueue(opts: { accountId: string, apiToken: string, queueName: string }): Promise<Queue> {
    const { accountId, apiToken, queueName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/queues/${queueName}`;
    return (await execute<Queue>('getQueue', 'GET', url.toString(), apiToken)).result;
}

export async function deleteQueue(opts: { accountId: string, apiToken: string, queueName: string }): Promise<void> {
    const { accountId, apiToken, queueName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/queues/${queueName}`;
    await execute<Queue>('deleteQueue', 'DELETE', url.toString(), apiToken);
    // 200 result: null
}

export async function createQueue(opts: { accountId: string, apiToken: string, queueName: string }): Promise<NewQueue> {
    const { accountId, apiToken, queueName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/queues`;
    const payload = { queue_name: queueName };
    return (await execute<NewQueue>('createQueue', 'POST', url, apiToken, payload)).result;
}

export interface NewQueue {
    readonly queue_name: string;
    readonly created_on: string; // 2022-10-30T16:05:14.966372Z
    readonly modified_on: string; // 2022-10-30T16:05:14.966372Z
}

export interface Queue extends NewQueue {
    readonly producers_total_count: number;
    readonly producers: QueueProducerInfo[];
    readonly consumers_total_count: number;
    readonly consumers: QueueConsumerInfo[];
}

export interface QueueProducerInfo {
    readonly script: string;
}

export interface QueueConsumerInfo {
    readonly script: string;
    readonly settings: QueueConsumerSettings;
}

export async function putQueueConsumer(opts: { accountId: string, apiToken: string, queueName: string, scriptName: string, envName?: string, batchSize?: number, maxRetries?: number, maxWaitTimeMillis?: number, deadLetterQueue?: string }): Promise<QueueConsumer> {
    const { accountId, apiToken, queueName, scriptName, envName, batchSize, maxRetries, maxWaitTimeMillis, deadLetterQueue } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/queues/${queueName}/consumers/${scriptName}${typeof envName === 'string' ? `/${envName}` : ''}`;
    const payload = {
        settings: {
            batch_size: batchSize,
            max_retries: maxRetries,
            max_wait_time_ms: maxWaitTimeMillis,
        },
        dead_letter_queue: deadLetterQueue,
    };
    return (await execute<QueueConsumer>('putQueueConsumer', 'PUT', url, apiToken, payload)).result;
}

export async function deleteQueueConsumer(opts: { accountId: string, apiToken: string, queueName: string, scriptName: string, envName?: string }): Promise<void> {
    const { accountId, apiToken, queueName, scriptName, envName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/queues/${queueName}/consumers/${scriptName}${typeof envName === 'string' ? `/${envName}` : ''}`;
    
    await execute('deleteQueueConsumer', 'DELETE', url, apiToken);
    // 200 result: null
}


export interface QueueConsumerSettings {
    /** The maximum number of messages allowed in each batch. */
    readonly batch_size?: number; // default: 10

    /** The maximum number of retries for a message, if it fails or retryAll() is invoked. */
    readonly max_retries?: number; // default: 3

    /** The maximum number of millis to wait until a batch is full (max: 30 seconds). */
    readonly max_wait_time_ms?: number; // default: 5000
}

export interface QueueConsumer {
    readonly queue_name: string;
    readonly script_name: string;
    readonly environment_name?: string;
    readonly settings: QueueConsumerSettings;
    /** The name of another Queue to send a message if it fails processing at least max_retries times. 
     * 
     * If a dead_letter_queue is not defined, messages that repeatedly fail processing will eventually be discarded. 
     * If there is no Queue with the specified name, it will be created automatically. */
    readonly dead_letter_queue: string; // '' for unset
    readonly created_on: string; // 2022-10-30T16:38:22.373479Z
}

//#endregion

//#region Logpush (account-level)

export async function listLogpushJobs(opts: { accountId: string, apiToken: string, page?: number }): Promise<unknown[]> {
    const { accountId, apiToken, page } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/logpush/jobs`);
    if (typeof page === 'number') url.searchParams.set('page', page.toString());
    return (await execute<Queue[]>('listLogpushJobs', 'GET', url.toString(), apiToken)).result;
}

export async function createLogpushJob(opts: { accountId: string, apiToken: string, name: string, logpullOptions: string, filter: string | undefined, destinationConfiguration: string, dataset: string, enabled: boolean }): Promise<LogpushJob> {
    const { accountId, apiToken, name, logpullOptions: logpull_options, filter, destinationConfiguration: destination_conf, dataset, enabled } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/logpush/jobs`;
    const payload = { name, logpull_options, filter, destination_conf, dataset, enabled };
    return (await execute<LogpushJob>('createLogpushJob', 'POST', url, apiToken, payload)).result;
}

export async function updateLogpushJob(opts: { accountId: string, apiToken: string, jobId: number, logpullOptions?: string, filter?: string, destinationConfiguration?: string, frequency?: string, enabled?: boolean }): Promise<LogpushJob> {
    const { accountId, apiToken, jobId, logpullOptions: logpull_options, filter, destinationConfiguration: destination_conf, frequency, enabled } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/logpush/jobs/${jobId}`;
    const payload = { logpull_options, filter, destination_conf, frequency, enabled };
    return (await execute<LogpushJob>('updateLogpushJob', 'PUT', url, apiToken, payload)).result;
}

export async function deleteLogpushJob(opts: { accountId: string, apiToken: string, jobId: number }): Promise<LogpushJobReference> {
    const { accountId, apiToken, jobId } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/logpush/jobs/${jobId}`;
    return (await execute<LogpushJobReference>('deleteLogpushJob', 'DELETE', url, apiToken)).result;
}

export interface LogpushJob {
    readonly id: number; // e.g. 136165
    readonly dataset: string; // e.g. workers_trace_events
    readonly frequency: string; // 'high' or 'low'
    readonly filter: string; // json
    readonly kind: string; // blank or 'edge'
    readonly enabled: boolean;
    readonly name: string;
    readonly logpull_options: string;
    readonly destination_conf: string;
    readonly last_complete: string | null; // datetime
    readonly last_error: string | null; // datetime
    readonly error_message: string | null;
}

export interface LogpushJobReference {
    readonly id: number; // e.g. 136165
}

//#endregion

export class CloudflareApi {
    static DEBUG = false;
    static URL_TRANSFORMER: (url: string) => string = v => v;
}

//

const APPLICATION_JSON = 'application/json';
const APPLICATION_JSON_UTF8 = 'application/json; charset=utf-8';
const APPLICATION_OCTET_STREAM = 'application/octet-stream';
const TEXT_PLAIN_UTF8 = 'text/plain; charset=utf-8';

function computeBaseUrl(): string {
    return CloudflareApi.URL_TRANSFORMER(`https://api.cloudflare.com/client/v4`);
}

function computeAccountBaseUrl(accountId: string): string {
    return CloudflareApi.URL_TRANSFORMER(`https://api.cloudflare.com/client/v4/accounts/${accountId}`);
}

// deno-lint-ignore no-explicit-any
function isStringRecord(obj: any): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && obj.constructor === Object;
}

type ExecuteBody = string | Record<string, unknown> | Record<string, unknown>[] | FormData;

async function execute<Result>(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', url: string, apiToken: string, body?: ExecuteBody, responseType?: 'json'): Promise<CloudflareApiResponse<Result>>;
async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', url: string, apiToken: string, body?: ExecuteBody, responseType?: 'bytes'): Promise<Uint8Array>;
async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', url: string, apiToken: string, body?: ExecuteBody, responseType?: 'bytes?'): Promise<Uint8Array | undefined>;
async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', url: string, apiToken: string, body?: ExecuteBody, responseType?: 'text'): Promise<string>;
async function execute<Result>(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', url: string, apiToken: string, body?: ExecuteBody, responseType?: 'json?'): Promise<CloudflareApiResponse<Result> | undefined>;
async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', url: string, apiToken: string, body?: ExecuteBody, responseType?: 'empty'): Promise<undefined>;
async function execute<Result>(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', url: string, apiToken: string, body?: ExecuteBody, responseType: 'json' | 'json?' | 'bytes' | 'bytes?' | 'text' | 'empty' = 'json'): Promise<CloudflareApiResponse<Result> | Uint8Array | string | undefined> {
    if (CloudflareApi.DEBUG) console.log(`${op}: ${method} ${url}`);
    const headers = new Headers({ 'Authorization': `Bearer ${apiToken}`});
    let bodyObj: Record<string, unknown> | Record<string, unknown>[] | undefined;
    if (typeof body === 'string') {
        headers.set('Content-Type', TEXT_PLAIN_UTF8);
    } else if (isStringRecord(body) || Array.isArray(body)) {
        headers.set('Content-Type', APPLICATION_JSON_UTF8);
        bodyObj = body;
        body = JSON.stringify(body, undefined, 2);
    }
    if (CloudflareApi.DEBUG) console.log([...headers].map(v => v.join(': ')).join('\n'));
    if (CloudflareApi.DEBUG && bodyObj) console.log(bodyObj);
    const fetchResponse = await fetch(url, { method, headers, body });
    if (CloudflareApi.DEBUG) console.log(`${fetchResponse.status} ${fetchResponse.url}`);
    if (CloudflareApi.DEBUG) console.log([...fetchResponse.headers].map(v => v.join(': ')).join('\n'));
    const contentType = fetchResponse.headers.get('Content-Type') || '';
    if (responseType === 'empty' && fetchResponse.status >= 200 && fetchResponse.status < 300) {
        if (contentType !== '') throw new Error(`Unexpected content-type (expected none): ${contentType}, fetchResponse=${fetchResponse}, body=${await fetchResponse.text()}`);
        const text = await fetchResponse.text();
        if (text !== '') throw new Error(`Unexpected body (expected none): ${text}, fetchResponse=${fetchResponse}, body=${text}`);
        return;
    }
    if ((responseType === 'bytes' || responseType === 'bytes?') && contentType === APPLICATION_OCTET_STREAM) {
        const buffer = await fetchResponse.arrayBuffer();
        return new Uint8Array(buffer);
    }
    if (responseType === 'text') {
        return await fetchResponse.text();
    }
    if (![APPLICATION_JSON_UTF8, APPLICATION_JSON].includes(contentType.toLowerCase())) {
        throw new Error(`Unexpected content-type: ${contentType}, fetchResponse=${fetchResponse}, body=${await fetchResponse.text()}`);
    }
    const apiResponse = await fetchResponse.json() as CloudflareApiResponse<Result>;
    if (CloudflareApi.DEBUG) console.log(apiResponse);
    if (!apiResponse.success) {
        if (fetchResponse.status === 404 && ['bytes?', 'json?'].includes(responseType)) return undefined;
        throw new CloudflareApiError(`${op} failed: status=${fetchResponse.status}, errors=${apiResponse.errors.map(v => `${v.code} ${v.message}`).join(', ')}`, fetchResponse.status, apiResponse.errors);
    }
    return apiResponse;
}

//

export class CloudflareApiError extends Error {
    readonly status: number;
    readonly errors: readonly Message[];

    constructor(message: string, status: number, errors: readonly Message[]) {
        super(message);
        this.status = status;
        this.errors = errors;
    }
}

export interface Message {
    readonly code: number;
    readonly message: string;
}

export interface CloudflareApiResponse<Result> {
    readonly result: Result;
    readonly success: boolean;
    readonly errors: readonly Message[];
    readonly messages?: readonly Message[];
}

export interface ResultInfo {
    readonly page: number;
    readonly per_page: number;
    readonly total_pages: number;
    readonly count: number;
    readonly total_count: number;
}
