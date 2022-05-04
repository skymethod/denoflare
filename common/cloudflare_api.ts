//#region Durable objects

export async function listDurableObjectsNamespaces(accountId: string, apiToken: string): Promise<readonly DurableObjectsNamespace[]> {
    const url = `${computeAccountBaseUrl(accountId)}/workers/durable_objects/namespaces`;
    return (await execute('listDurableObjectsNamespaces', 'GET', url, apiToken) as ListDurableObjectsNamespacesResponse).result;
}

export async function createDurableObjectsNamespace(accountId: string, apiToken: string, payload: { name: string, script?: string, class?: string }): Promise<DurableObjectsNamespace> {
    const url = `${computeAccountBaseUrl(accountId)}/workers/durable_objects/namespaces`;
    return (await execute('createDurableObjectsNamespace', 'POST', url, apiToken, payload) as CreateDurableObjectsNamespaceResponse).result;
}

export async function updateDurableObjectsNamespace(accountId: string, apiToken: string, payload: { id: string, name?: string, script?: string, class?: string }): Promise<DurableObjectsNamespace> {
    const url = `${computeAccountBaseUrl(accountId)}/workers/durable_objects/namespaces/${payload.id}`;
    return (await execute('updateDurableObjectsNamespace', 'PUT', url, apiToken, payload) as UpdateDurableObjectsNamespaceResponse).result;
}

export async function deleteDurableObjectsNamespace(accountId: string, apiToken: string, namespaceId: string): Promise<void> {
    const url = `${computeAccountBaseUrl(accountId)}/workers/durable_objects/namespaces/${namespaceId}`;
    await execute('deleteDurableObjectsNamespace', 'DELETE', url, apiToken) as CloudflareApiResponse;
}

//#endregion

//#region Worker scripts

export async function listScripts(accountId: string, apiToken: string): Promise<readonly Script[]> {
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts`;
    return (await execute('listScripts', 'GET', url, apiToken) as ListScriptsResponse).result;
}

export async function putScript(accountId: string, scriptName: string, apiToken: string, opts: { scriptContents: Uint8Array, bindings?: Binding[], migrations?: Migrations, parts?: Part[], isModule: boolean, usageModel?: 'bundled' | 'unbound', enableR2?: boolean }): Promise<Script> {
    const { scriptContents, bindings, migrations, parts, isModule, usageModel, enableR2 } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}`;
    const formData = new FormData();
    const metadata: Record<string, unknown> = { 
        bindings, 
        usage_model: usageModel,
        migrations
    };
    if (enableR2) {
        // compatibility dates or flags no longer needed
    }

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
    return (await execute('putScript', 'PUT', url, apiToken, formData) as PutScriptResponse).result;
}

export async function deleteScript(accountId: string, scriptName: string, apiToken: string): Promise<DeleteScriptResult> {
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}`;
    return (await execute('deleteScript', 'DELETE', url, apiToken) as DeleteScriptResponse).result;
}

//#endregion

//#region Worker Account Settings

export async function getWorkerAccountSettings(accountId: string, apiToken: string): Promise<WorkerAccountSettings> {
    const url = `${computeAccountBaseUrl(accountId)}/workers/account-settings`;
    return (await execute('getWorkerAccountSettings', 'GET', url, apiToken) as WorkerAccountSettingsResponse).result;
}

export async function putWorkerAccountSettings(accountId: string, apiToken: string, opts: { defaultUsageModel: 'bundled' | 'unbound' }): Promise<WorkerAccountSettings> {
    const { defaultUsageModel: default_usage_model } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/account-settings`;
    return (await execute('putWorkerAccountSettings', 'PUT', url, apiToken, { default_usage_model }) as WorkerAccountSettingsResponse).result;
}

//#endregion

//#region Workers KV

export async function getKeyValue(accountId: string, namespaceId: string, key: string, apiToken: string): Promise<Uint8Array | undefined> {
    const url = `${computeAccountBaseUrl(accountId)}/storage/kv/namespaces/${namespaceId}/values/${key}`;
    return await execute('getKeyValue', 'GET', url, apiToken, undefined, 'bytes?');
}

export async function getKeyMetadata(accountId: string, namespaceId: string, key: string, apiToken: string): Promise<Record<string, string> | undefined> {
    const url = `${computeAccountBaseUrl(accountId)}/storage/kv/namespaces/${namespaceId}/metadata/${key}`;
    const res = await execute('getKeyMetadata', 'GET', url, apiToken, undefined, 'json?');
    return res ? (res as GetKeyMetadataResponse).result : undefined;
}

/**
 * Write key-value pair
 * https://api.cloudflare.com/#workers-kv-namespace-write-key-value-pair
 * 
 * Write key-value pair with metadata
 * https://api.cloudflare.com/#workers-kv-namespace-write-key-value-pair-with-metadata
 */
export async function putKeyValue(accountId: string, namespaceId: string, key: string, value: string, apiToken: string, opts: { expiration?: number, expirationTtl?: number, metadata?: Record<string, unknown> } = {}) {
    const { expiration, expirationTtl, metadata } = opts;
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

//#endregion

//#region Workers Tails

/**
 * List Tails
 * Lists all active Tail sessions for a given Worker
 * https://api.cloudflare.com/#worker-tails-list-tails
 */
export async function listTails(accountId: string, scriptName: string, apiToken: string): Promise<readonly Tail[]> {
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}/tails`;
    return (await execute('listTails', 'GET', url, apiToken) as ListTailsResponse).result;
}

/**
 * Create Tail
 * https://api.cloudflare.com/#worker-create-tail
 * 
 * Constrained to at most one tail per script
 */
export async function createTail(accountId: string, scriptName: string, apiToken: string): Promise<Tail> {
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}/tails`;
    return (await execute('createTail', 'POST', url, apiToken) as CreateTailResponse).result;
}

/**
 * Send Tail Heartbeat
 * https://api.cloudflare.com/#worker-tail-heartbeat
 */
export async function sendTailHeartbeat(accountId: string, scriptName: string, tailId: string, apiToken: string): Promise<Tail> {
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}/tails/${tailId}/heartbeat`;
    return (await execute('sendTailHeartbeat', 'POST', url, apiToken) as SendTailHeartbeatResponse).result;
}

/**
 * Delete Tail
 * https://api.cloudflare.com/#worker-delete-tail
 */
export async function deleteTail(accountId: string, scriptName: string, tailId: string, apiToken: string): Promise<void> {
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}/tails/${tailId}`;
    await execute('deleteTail', 'DELETE', url, apiToken); // result = null
}

export interface CreateTailResponse extends CloudflareApiResponse {
    readonly result: Tail;
}

export interface Tail {
    readonly id: string; // cf id
    readonly url: string // e.g. wss://tail.developers.workers.dev/<tail-id>
    readonly 'expires_at': string; // e.g. 2021-08-20T23:45:17Z  (4-6 hrs from creation)
}

export interface ListTailsResponse extends CloudflareApiResponse {
    readonly result: readonly Tail[];
}

export interface SendTailHeartbeatResponse extends CloudflareApiResponse {
    readonly result: Tail;
}

//#endregion

//#region R2

/**
 * List R2 Buckets
 */
export async function listR2Buckets(accountId: string, apiToken: string): Promise<readonly Bucket[]> {
    const url = `${computeAccountBaseUrl(accountId)}/r2/buckets`;
    return (await execute('listR2Buckets', 'GET', url, apiToken) as ListR2BucketsResponse).result;
}

export interface ListR2BucketsResponse extends CloudflareApiResponse {
    readonly result: readonly Bucket[];
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
export async function createR2Bucket(accountId: string, bucketName: string, apiToken: string): Promise<void> {
    const url = `${computeAccountBaseUrl(accountId)}/r2/buckets/${bucketName}`;
    await execute('createR2Bucket', 'PUT', url, apiToken);
    // result is: {}
}

/**
 * Delete R2 Bucket
 * 
 * @throws if not exists: 404 10006 The specified bucket does not exist.
 */
export async function deleteR2Bucket(accountId: string, bucketName: string, apiToken: string): Promise<void> {
    const url = `${computeAccountBaseUrl(accountId)}/r2/buckets/${bucketName}`;
    await execute('deleteR2Bucket', 'DELETE', url, apiToken);
    // result is: {}
}

//#endregion

//#region Flags

/**
 * List Account Flags
 */
export async function listFlags(accountId: string, apiToken: string): Promise<FlagsResult> {
    const url = `${computeAccountBaseUrl(accountId)}/flags`;
    return (await execute('listFlags', 'GET', url, apiToken) as ListFlagsResponse).result;
}

export type FlagsResult = Record<string, Record<string, unknown>>;

export interface ListFlagsResponse extends CloudflareApiResponse {
    readonly result: FlagsResult;
}

//#endregion

export class CloudflareApi {
    static DEBUG = false;
    static URL_TRANSFORMER: (url: string) => string = v => v;
}

//


const APPLICATION_JSON = 'application/json';
const APPLICATION_JSON_UTF8 = 'application/json; charset=UTF-8';
const APPLICATION_OCTET_STREAM = 'application/octet-stream';
const TEXT_PLAIN_UTF8 = 'text/plain; charset=UTF-8';

function computeAccountBaseUrl(accountId: string): string {
    return CloudflareApi.URL_TRANSFORMER(`https://api.cloudflare.com/client/v4/accounts/${accountId}`);
}

// deno-lint-ignore no-explicit-any
function isStringRecord(obj: any): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && obj.constructor === Object;
}

async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, apiToken: string, body?: string | Record<string, unknown> | FormData, responseType?: 'json'): Promise<CloudflareApiResponse>;
async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, apiToken: string, body?: string | Record<string, unknown> | FormData, responseType?: 'bytes'): Promise<Uint8Array>;
async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, apiToken: string, body?: string | Record<string, unknown> | FormData, responseType?: 'bytes?'): Promise<Uint8Array | undefined>;
async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, apiToken: string, body?: string | Record<string, unknown> | FormData, responseType?: 'text?'): Promise<string | undefined>;
async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, apiToken: string, body?: string | Record<string, unknown> | FormData, responseType?: 'json?'): Promise<CloudflareApiResponse | undefined>;
async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, apiToken: string, body?: string | Record<string, unknown> | FormData, responseType: 'json' | 'json?' | 'bytes' | 'bytes?' | 'text?' = 'json'): Promise<CloudflareApiResponse | Uint8Array | string | undefined> {
    if (CloudflareApi.DEBUG) console.log(`${op}: ${method} ${url}`);
    const headers = new Headers({ 'Authorization': `Bearer ${apiToken}`});
    if (typeof body === 'string') {
        headers.set('Content-Type', TEXT_PLAIN_UTF8);
    } else if (isStringRecord(body)) {
        headers.set('Content-Type', APPLICATION_JSON_UTF8);
        body = JSON.stringify(body);
        if (CloudflareApi.DEBUG) console.log(body);
    }
    const fetchResponse = await fetch(url, { method, headers, body });
    if (CloudflareApi.DEBUG) console.log(`${fetchResponse.status} ${fetchResponse.url}`);
    if (CloudflareApi.DEBUG) console.log([...fetchResponse.headers].map(v => v.join(': ')).join('\n'));
    const contentType = fetchResponse.headers.get('Content-Type') || '';
    if ((responseType === 'bytes' || responseType === 'bytes?') && contentType === APPLICATION_OCTET_STREAM) {
        const buffer = await fetchResponse.arrayBuffer();
        return new Uint8Array(buffer);
    }
    if (responseType === 'text?' && contentType.startsWith('text/')) {
        return await fetchResponse.text();
    }
    if (![APPLICATION_JSON_UTF8, APPLICATION_JSON].includes(contentType)) {
        throw new Error(`Unexpected content-type: ${contentType}, fetchResponse=${fetchResponse}, body=${await fetchResponse.text()}`);
    }
    const apiResponse = await fetchResponse.json() as CloudflareApiResponse;
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

export type Binding = PlainTextBinding | SecretTextBinding | KvNamespaceBinding | DurableObjectNamespaceBinding | WasmModuleBinding | ServiceBinding | R2Binding;

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

export interface R2Binding {
    readonly type: 'r2_bucket';
    readonly name: string;
    readonly 'bucket_name': string;
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

export interface Message {
    readonly code: number;
    readonly message: string;
}

export interface CloudflareApiResponse {
    readonly success: boolean;
    readonly errors: readonly Message[];
    readonly messages?: readonly Message[];
}

export interface ListDurableObjectsNamespacesResponse extends CloudflareApiResponse {
    readonly result: readonly DurableObjectsNamespace[];
}

export interface CreateDurableObjectsNamespaceResponse extends CloudflareApiResponse {
    readonly result: DurableObjectsNamespace;
}

export interface UpdateDurableObjectsNamespaceResponse extends CloudflareApiResponse {
    readonly result: DurableObjectsNamespace;
}

export interface DurableObjectsNamespace {
    readonly id: string;
    readonly name: string;
    readonly script: string | null;
    readonly class: string | undefined;
}

export interface PutScriptResponse extends CloudflareApiResponse {
    readonly result: Script;
}

export interface Script {
    readonly id: string;
    readonly etag: string;
    readonly handlers: readonly string[];
    readonly 'named_handlers'?: readonly NamedHandler[];
    readonly 'modified_on': string;
    readonly 'created_on': string;
    readonly 'usage_model': string;
}

export interface NamedHandler {
    readonly name: string;
    readonly handlers: readonly string[];
}

export interface DeleteScriptResponse extends CloudflareApiResponse {
    readonly result: DeleteScriptResult;
}

export interface DeleteScriptResult {
    readonly id: string;
}

export interface ListScriptsResponse extends CloudflareApiResponse {
    readonly result: readonly Script[];
}

export interface GetKeyMetadataResponse extends CloudflareApiResponse {
    readonly result: Record<string, string>;
}

export interface WorkerAccountSettings {
    readonly 'default_usage_model': string,
    readonly 'green_compute': boolean,
}

export interface WorkerAccountSettingsResponse extends CloudflareApiResponse {
    readonly result: WorkerAccountSettings;
}
