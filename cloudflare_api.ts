//#region Durable objects

export async function listDurableObjectsNamespaces(accountId: string, apiToken: string): Promise<readonly DurableObjectsNamespace[]> {
    const url = `${computeAccountBaseUrl(accountId)}/workers/durable_objects/namespaces`;
    return (await execute('listDurableObjectsNamespaces', 'GET', url, apiToken) as ListDurableObjectsNamespacesResponse).result;
}

export async function createDurableObjectsNamespace(accountId: string, apiToken: string, payload: { name: string, script?: string, class?: string}): Promise<DurableObjectsNamespace> {
    const url = `${computeAccountBaseUrl(accountId)}/workers/durable_objects/namespaces`;
    return (await execute('createDurableObjectsNamespace', 'POST', url, apiToken, JSON.stringify(payload)) as CreateDurableObjectsNamespaceResponse).result;
}

export async function updateDurableObjectsNamespace(accountId: string, apiToken: string, payload: { id: string, name?: string, script?: string, class?: string }): Promise<DurableObjectsNamespace> {
    const url = `${computeAccountBaseUrl(accountId)}/workers/durable_objects/namespaces/${payload.id}`;
    return (await execute('updateDurableObjectsNamespace', 'PUT', url, apiToken, JSON.stringify(payload)) as UpdateDurableObjectsNamespaceResponse).result;
}

export async function deleteDurableObjectsNamespace(accountId: string, apiToken: string, namespaceId: string): Promise<void> {
    const url = `${computeAccountBaseUrl(accountId)}/workers/durable_objects/namespaces/${namespaceId}`;
    await execute('deleteDurableObjectsNamespace', 'DELETE', url, apiToken) as CloudflareApiResponse;
}

//#endregion

//#region Worker scripts

export async function putScript(accountId: string, scriptName: string, scriptContents: Uint8Array, bindings: Binding[], apiToken: string): Promise<Script> {
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}`;
    const formData = new FormData();
    const metadata = { 'main_module': 'main', bindings, 'usage_model': 'bundled' };
    const metadataBlob = new Blob([ JSON.stringify(metadata) ], { type: APPLICATION_JSON });
    const scriptBlob = new Blob([ scriptContents.buffer ], { type: 'application/javascript+module' });
    formData.set('metadata', metadataBlob);
    formData.set('script', scriptBlob, 'main');
    return (await execute('putScript', 'PUT', url, apiToken, formData) as PutScriptResponse).result;
}

export async function deleteScript(accountId: string, scriptName: string, apiToken: string): Promise<DeleteScriptResult> {
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}`;
    return (await execute('deleteScript', 'DELETE', url, apiToken) as DeleteScriptResponse).result;
}

//#endregion


//#region Workers KV

export async function getKeyValue(accountId: string, namespaceId: string, key: string, apiToken: string): Promise<Uint8Array | undefined> {
    const url = `${computeAccountBaseUrl(accountId)}/storage/kv/namespaces/${namespaceId}/values/${key}`;
    return await execute('getKeyValue', 'GET', url, apiToken, undefined, 'bytes?');
}

export async function getKeyMetadata(accountId: string, namespaceId: string, key: string, apiToken: string): Promise<Record<string, string>> {
    const url = `${computeAccountBaseUrl(accountId)}/storage/kv/namespaces/${namespaceId}/metadata/${key}`;
    return (await execute('getKeyMetadata', 'GET', url, apiToken, undefined) as GetKeyMetadataResponse).result;
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

//

const DEBUG = false;

const APPLICATION_JSON = 'application/json';
const APPLICATION_JSON_UTF8 = 'application/json; charset=UTF-8';
const APPLICATION_OCTET_STREAM = 'application/octet-stream';

function computeAccountBaseUrl(accountId: string): string {
    return `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
}

async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, apiToken: string, body?: string /*json*/ | FormData, responseType?: 'json'): Promise<CloudflareApiResponse>;
async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, apiToken: string, body?: string /*json*/ | FormData, responseType?: 'bytes'): Promise<Uint8Array>;
async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, apiToken: string, body?: string /*json*/ | FormData, responseType?: 'bytes?'): Promise<Uint8Array | undefined>;
async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, apiToken: string, body?: string /*json*/ | FormData, responseType: 'json' | 'bytes' | 'bytes?' = 'json'): Promise<CloudflareApiResponse | Uint8Array | undefined> {
    const headers = new Headers({ 'Authorization': `Bearer ${apiToken}`});
    if (typeof body === 'string') {
        headers.set('Content-Type', APPLICATION_JSON_UTF8);
        if (DEBUG) console.log(body);
    }
    const fetchResponse = await fetch(url, { method, headers, body });
    const contentType = fetchResponse.headers.get('Content-Type') || '';
    if ((responseType === 'bytes' || responseType === 'bytes?') && contentType === APPLICATION_OCTET_STREAM) {
        const buffer = await fetchResponse.arrayBuffer();
        return new Uint8Array(buffer);
    }
    if (![APPLICATION_JSON_UTF8, APPLICATION_JSON].includes(contentType)) {
        throw new Error(`Unexpected content-type: ${contentType},  fetchResponse=${fetchResponse}, body=${await fetchResponse.text()}`);
    }
    const apiResponse = await fetchResponse.json() as CloudflareApiResponse;
    if (DEBUG) console.log(apiResponse);
    if (!apiResponse.success) {
        if (fetchResponse.status === 404 && responseType === 'bytes?') return undefined;
        throw new Error(`${op} failed: status=${fetchResponse.status}, errors=${apiResponse.errors.map(v => `${v.code} ${v.message}`).join(', ')}`);
    }
    return apiResponse;
}

//

export type Binding = DurableObjectNamespaceBinding;

export interface DurableObjectNamespaceBinding {
    readonly type: 'durable_object_namespace';
    readonly name: string;
    readonly 'namespace_id': string;
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

export interface GetKeyMetadataResponse extends CloudflareApiResponse {
    readonly result: Record<string, string>;
}
