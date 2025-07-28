//#region Durable objects

import { AiModelInput, AiModelOutput, D1QueryMetadata } from './cloudflare_workers_types.d.ts';

export async function listDurableObjectsNamespaces(opts: { accountId: string, apiToken: string, perPage?: number }): Promise<readonly DurableObjectsNamespace[]> {
    const { accountId, apiToken, perPage } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/workers/durable_objects/namespaces`);
    if (typeof perPage === 'number') url.searchParams.set('per_page', perPage.toString());
    return (await execute<readonly DurableObjectsNamespace[]>('listDurableObjectsNamespaces', 'GET', url.toString(), apiToken)).result;
}

export async function createDurableObjectsNamespace(opts: { accountId: string, apiToken: string, name: string, script?: string, className?: string, useSqlite?: boolean, useContainers?: boolean }): Promise<DurableObjectsNamespace> {
    const { accountId, apiToken, name, script, className, useSqlite, useContainers } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/durable_objects/namespaces`;
    return (await execute<DurableObjectsNamespace>('createDurableObjectsNamespace', 'POST', url, apiToken, { name, script, class: className, use_sqlite: useSqlite, use_containers: useContainers })).result;
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
    readonly use_sqlite: boolean;
    readonly use_containers?: boolean;
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

// https://developers.cloudflare.com/api/operations/worker-script-list-workers
export async function listScripts(opts: { accountId: string, apiToken: string }): Promise<readonly Script[]> {
    const { accountId, apiToken } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts`;
    return (await execute<readonly Script[]>('listScripts', 'GET', url, apiToken)).result;
}

// https://developers.cloudflare.com/api/operations/worker-script-get-settings
export async function getScriptSettings(opts: { accountId: string, scriptName: string, apiToken: string }): Promise<ScriptSettings> {
    const { accountId, scriptName, apiToken } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}/settings`;
    return (await execute<ScriptSettings>('getScriptSettings', 'GET', url, apiToken)).result;
}

export interface ScriptSettings {
    readonly placement: { mode?: string };
    readonly compatibility_date: string;
    readonly compatibility_flags: string[];
    readonly usage_model: string;
    readonly tags: string[];
    readonly tail_consumers: { service: string, namespace?: string, environment?: string }[];
    readonly logpush: boolean;
    readonly bindings: WorkerBinding[];
}

export type Observability = {
    enabled: boolean,
    head_sampling_rate?: number, // between 0 and 1 (default)
}

export type PutScriptOpts = { 
    accountId: string,
    scriptName: string,
    apiToken: string,
    scriptContents: Uint8Array,
    bindings?: Binding[],
    migrations?: Migrations,
    parts?: Part[],
    isModule: boolean,
    usageModel?: 'bundled' | 'unbound',
    logpush?: boolean,

    /** Date indicating targeted support in the Workers runtime. Backwards incompatible fixes to the runtime following this date will not affect this Worker. */
    compatibilityDate?: string,

    /** Flags that enable or disable certain features in the Workers runtime. Used to enable upcoming features or opt in or out of specific changes not included in a compatibility_date. */
    compatibilityFlags?: string[],

    observability?: Observability,
    containers?: { class_name: string }[],
    limits?: { cpu_ms: number },
    sourceMapContents?: string,

    /** Retain assets which exist for a previously uploaded Worker version; used in lieu of providing a completion token. */
    keep_assets?: boolean,

    assets?: WorkerAssetsOpts,
};

export type WorkerAssetsOpts = {
    /** Completion token provided upon successful upload of all files from a registered manifest. */
    jwt?: string,

    config?: WorkersAssetsConfiguration,
}

export type WorkersAssetsConfiguration = {

    /** The contents of a _headers file (used to attach custom headers on asset responses). */
    _headers?: string,

    /** The contents of a _redirects file (used to apply redirects or proxy paths ahead of asset serving). */
    _redirects?: string,

    /** Determines the redirects and rewrites of requests for HTML content. */
    html_handling?: 'auto-trailing-slash' | 'force-trailing-slash' | 'drop-trailing-slash' | 'none',

    /** Determines the response when a request does not match a static asset, and there is no Worker script. */
    not_found_handling?: 'none' | '404-page' | 'single-page-application',

    /** Contains a list of path rules to control routing to either the Worker or assets.
     * 
     * Glob (*) and negative (!) rules are supported. Rules must start with either '/' or '!/'. At least one non-negative rule must be provided, and negative rules have higher precedence than non-negative rules.
     * 
     * If boolean, enables routing to always invoke the Worker script ahead of all requests. When true, this is equivalent to ["/*"] in the string array version of this field.
     */
    run_worker_first?: boolean | string[],

}

export async function putScript(opts: PutScriptOpts): Promise<Script> {
    const { accountId, scriptName, apiToken } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}`;
    const formData = computeUploadForm(opts);
    return (await execute<Script>('putScript', 'PUT', url, apiToken, formData)).result;
}

export async function putScriptVersion(opts: PutScriptOpts & { messageAnnotation?: string, tagAnnotation?: string, triggeredByAnnotation?: string }): Promise<ScriptVersion> {
    const { accountId, scriptName, apiToken, messageAnnotation, tagAnnotation, triggeredByAnnotation } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}/versions`;
    const formData = computeUploadForm(opts);
    const annotations: Record<string, string> = {
        ...(messageAnnotation ? { 'workers/message': messageAnnotation } : {}),
        ...(tagAnnotation ? { 'workers/tag': tagAnnotation } : {}),
        ...(triggeredByAnnotation ? { 'workers/triggered_by': triggeredByAnnotation } : {}),
    };
    if (Object.keys(annotations).length > 0) {
        formData.set('annotations', JSON.stringify(annotations));
    }
    console.log(formData.get('annotations'));
    return (await execute<ScriptVersion>('putScriptVersion', 'POST', url, apiToken, formData)).result;
}

export interface ScriptVersion {
    readonly id: string; // e.g. 5ddf5f19-6a2f-4a9b-8f14-633549792386
    readonly number: number; // e.g. 4
    readonly metadata: ScriptVersionMetadata;
    readonly annotations: Record<string, unknown>; // e.g. {}
    readonly resources: ScriptVersionResources;
}

export interface ScriptVersionMetadata {
    readonly created_on: string;
    readonly modified_on: string;
    readonly source: string; // e.g. api
    readonly author_id: string;
    readonly author_email: string;
}

export interface ScriptVersionResources {
    readonly script: ScriptVersionResourcesScript,
    readonly script_runtime: { readonly usage_model: string };
    readonly bindings: readonly WorkerBinding[];
}

export interface ScriptVersionResourcesScript {
    readonly etag: string;
    readonly handlers: readonly string[]; // e.g. [ "fetch" ]
    readonly last_deployed_from: string; // e.g. api
}

function computeUploadForm(opts: PutScriptOpts & { tags?: string[] }): FormData {
    const { scriptContents, bindings, migrations, parts, isModule, usageModel, logpush, compatibilityDate, compatibilityFlags, observability, containers, limits, sourceMapContents, keep_assets, assets, tags } = opts;

    const formData = new FormData();
    const metadata: Record<string, unknown> = { 
        bindings, 
        usage_model: usageModel,
        migrations,
        logpush,
        compatibility_date: compatibilityDate,
        compatibility_flags: compatibilityFlags,
        observability,
        containers,
        limits,
        keep_assets,
        assets,
        tags,
    };

    if (isModule) {
        metadata['main_module'] = 'main.js';
    } else {
        metadata['body_part'] = 'script';   
    }
    if (CloudflareApi.DEBUG) console.log('metadata', JSON.stringify(metadata, undefined, 2));
    const metadataBlob = new Blob([ JSON.stringify(metadata) ], { type: APPLICATION_JSON });
    formData.set('metadata', metadataBlob);
    if (isModule) {
        const scriptBlob = new Blob([ scriptContents.buffer as ArrayBuffer ], { type: 'application/javascript+module' });
        formData.set('main.js', scriptBlob, 'main.js');
        if (sourceMapContents) {
            const obj = JSON.parse(sourceMapContents);
            if (!obj.file) {
                obj.file = 'main.js';
                obj.sourceRoot = '';
            }
            // TODO: upload succeeds, but still not getting picked up
            const sourceMapBlob = new Blob([ JSON.stringify(obj) ], { type: 'application/source-map' });
            formData.set('main.js.map', sourceMapBlob, 'main.js.map');
        }
    } else {
        const scriptBlob = new Blob([ scriptContents.buffer as ArrayBuffer ], { type: 'application/javascript' });
        formData.set('script', scriptBlob);
    }
   
    for (const { name, value, fileName } of (parts || [])) {
        if (typeof value === 'string') {
            if (fileName !== undefined) throw new Error(`Bad ${name} form param: filename '${fileName} is not allowed for string value`);
            formData.set(name, value);
        } else {
            formData.set(name, value, fileName);
        }
    }
    return formData;
}

export async function updateScriptVersionAllocation(opts: { accountId: string, apiToken: string, scriptName: string, percentages: Record<string /* version id */, number /* e.g. 100 */>}): Promise<ScriptVersionAllocationResult> {
    const { accountId, scriptName, apiToken, percentages } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}/deployments`;

    const versions: WorkerVersionAllocation[] = Object.entries(percentages).map(v => ({ version_id: v[0], percentage: v[1] }));
    const body = { versions };
    return (await execute<ScriptVersionAllocationResult>('updateScriptVersionAllocation', 'POST', url, apiToken, body)).result;
}

export interface ScriptVersionAllocationResult {
    readonly id: string; // versioned-deployment id
}

export type Binding = PlainTextBinding | SecretTextBinding | KvNamespaceBinding | DurableObjectNamespaceBinding | WasmModuleBinding | ServiceBinding | R2BucketBinding | AnalyticsEngineBinding | D1DatabaseBinding | QueueBinding | SecretKeyBinding | BrowserBinding | AiBinding | HyperdriveBinding | VersionMetadataBinding | SendEmailBinding | RatelimitBinding | DispatchNamespaceBinding | AssetsBinding;

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
    readonly namespace_id?: string;
    readonly class_name?: string;
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

export interface BrowserBinding {
    readonly type: 'browser';
    readonly name: string;
}

export interface AiBinding {
    readonly type: 'ai';
    readonly name: string;
}

export interface HyperdriveBinding {
    readonly type: 'hyperdrive';
    readonly name: string;
    readonly id: string;
}

export interface VersionMetadataBinding {
    readonly type: 'version_metadata';
    readonly name: string;
}

export interface SendEmailBinding {
    readonly type: 'send_email';
    readonly name: string;
    readonly destination_address?: string;
    readonly allowed_destination_addresses?: string[];
}

export interface RatelimitBinding {
    readonly type: 'ratelimit';
    readonly name: string;
    readonly namespace_id: string;
    readonly simple: { readonly limit: number, readonly period: number };
}

export interface DispatchNamespaceBinding {
    readonly type: 'dispatch_namespace';
    readonly name: string;
    readonly namespace: string;
	readonly outbound?: {
        readonly worker: {
            readonly service: string;
            readonly environment?: string;
        };
        readonly params?: { name: string }[];
    };
}

export interface AssetsBinding {
    readonly type: 'assets';
    readonly name: string;
}

// this is likely not correct, but it works to delete obsolete DO classes at least
export interface OldMigrations {
    readonly tag: string;
    readonly deleted_classes: string[];
}

export interface NewMigrations {
    readonly old_tag?: string;
    readonly new_tag?: string;
    readonly steps: {
        readonly new_classes?: string[];
        readonly new_sqlite_classes?: string[];
        readonly renamed_classes?: {
            readonly from: string;
            readonly to: string;
        }[];
        readonly deleted_classes?: string[];
    }[];
}

export type Migrations = OldMigrations | NewMigrations;

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
    readonly named_handlers?: readonly NamedHandler[];
    readonly modified_on: string;
    readonly created_on: string;
    readonly usage_model: string;
    readonly last_deployed_from: string;
    readonly logpush?: boolean;
    readonly deployment_id?: string;
    readonly tags?: readonly string[]
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
    readonly bindings: readonly WorkerBinding[];
}

export type WorkerBinding = Record<string, unknown> & { name: string, type: string };

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

//#region Worker Versioned Deployments

export async function listWorkerVersionedDeployments(opts: { accountId: string, apiToken: string, scriptName: string }): Promise<WorkerVersionedDeploymentsResult> {
    const { accountId, apiToken, scriptName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}/deployments`;
    return (await execute<WorkerVersionedDeploymentsResult>('listWorkerVersionedDeployments', 'GET', url, apiToken)).result;
}

export interface WorkerVersionedDeploymentsResult {
    readonly deployments: WorkerVersionedDeployment[];
}

export interface WorkerVersionedDeployment {
    readonly id: string; // e.g. 97772553-126b-4286-b23c-f4158f82ec53
    readonly source: string; // e.g. api
    readonly strategy: string; // e.g. percentage
    readonly author_email: string; // e.g. user@example.com
    readonly annotations: null | Record<string, string>; // e.g. "workers/message": "Automatic deployment on upload.", "workers/triggered_by": "upload"
    readonly versions: WorkerVersionAllocation[];
    readonly created_on: string; // e.g. 2024-02-01T00:23:30.650801Z
}

export interface WorkerVersionAllocation {
    readonly version_id: string; // e.g. 6870034e-c031-4b01-b141-535e3e545299
    readonly percentage: number; // e.g. 100
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

export async function getWorkerServiceScript(opts: { accountId: string, apiToken: string, scriptName: string, environment: string }): Promise<FormData> {
    const { accountId, apiToken, scriptName, environment } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/services/${scriptName}/environments/${environment}/content`;
    return await execute('getWorkerServiceScript', 'GET', url, apiToken, undefined, 'form');
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

    return await execute('listKeys', 'GET', url.toString(), apiToken) as ListKeysResponse;
}

export interface KeyInfo {
    readonly expiration?: number;
    readonly metadata?: Record<string, string>;
    readonly name: string;
}

export interface ListKeysResponse extends CloudflareApiResponse<KeyInfo[]> {
    readonly result_info: {
        readonly count: number;
        readonly cursor: string;
    }
}

/**
 * List Namespaces
 * https://developers.cloudflare.com/api/operations/workers-kv-namespace-list-namespaces
 */
export async function listKVNamespaces(opts: { accountId: string, apiToken: string, direction?: 'asc' | 'desc', order?: 'id' | 'title', page?: number, per_page?: number }) {
    const { accountId, apiToken, direction, order, page, per_page } = opts;

    const url = new URL(`${computeAccountBaseUrl(accountId)}/storage/kv/namespaces`);

    if (direction) url.searchParams.set('direction', direction);
    if (order) url.searchParams.set('order', order);
    if (typeof page === 'number') url.searchParams.set('page', page.toString());
    if (typeof per_page === 'number') url.searchParams.set('per_page', per_page.toString());

    return await execute('listKVNamespaces', 'GET', url.toString(), apiToken) as ListKVNamespacesResponse;
}

export interface KVNamespaceInfo {
    readonly id: string;
    readonly title: string;
    readonly supports_url_encoding?: boolean;
}

export interface ListKVNamespacesResponse extends CloudflareApiResponse<KVNamespaceInfo[]> {
    readonly result_info: ResultInfo;
}

/**
 * Query KV Request Analytics
 * https://developers.cloudflare.com/api/operations/workers-kv-request-analytics-query-request-analytics
 */
export async function queryKvRequestAnalytics(opts: KVAnalyticsOpts): Promise<KVRequestAnalyticsResult> {
    return await queryKvAnalytics<KVRequestAnalyticsResult>(opts, 'queryKvRequestAnalytics', '/storage/analytics');
}

export type KVRequestAnalyticsResult = KVAnalyticsResult<'accountId' | 'responseCode' | 'requestType', 'requests' |  'writeKiB' | 'readKiB'>;

/**
 * Query KV Storage Analytics
 * https://developers.cloudflare.com/api/operations/workers-kv-stored-data-analytics-query-stored-data-analytics
 */
export async function queryKvStorageAnalytics(opts: KVAnalyticsOpts): Promise<KVStorageAnalyticsResult> {
    return await queryKvAnalytics<KVStorageAnalyticsResult>(opts, 'queryKvStorageAnalytics', '/storage/analytics/stored');
}

export type KVStorageAnalyticsResult = KVAnalyticsResult<'namespaceId', 'storedBytes' | 'storedKeys'>;

async function queryKvAnalytics<TResult>(opts: KVAnalyticsOpts, op: string, pathSuffix: string): Promise<TResult> {
    const { accountId, apiToken, dimensions, filters, limit, metrics, since, until, sort } = opts;

    const url = new URL(`${computeAccountBaseUrl(accountId)}${pathSuffix}`);

    if (typeof limit === 'number') url.searchParams.set('limit', limit.toString());
    if (typeof since === 'string') url.searchParams.set('since', since);
    if (typeof until === 'string') url.searchParams.set('until', until);
    if (typeof filters === 'string' && filters !== '') url.searchParams.set('filters', filters);
    if (dimensions && dimensions.length > 0) url.searchParams.set('dimensions', dimensions.join(','));
    if (metrics && metrics.length > 0) url.searchParams.set('metrics', metrics.join(','));
    if (sort && sort.length > 0) url.searchParams.set('sort', sort.join(','));

    return (await execute<TResult>(op, 'GET', url.toString(), apiToken)).result;
}

type KVAnalyticsOpts = { accountId: string, apiToken: string, dimensions?: string[], filters?: string, limit?: number, metrics?: string[], since?: string, until?: string, sort?: string[] };
interface KVAnalyticsResult<TDimension, TMetric extends string> {
    readonly rows: number;
    readonly data: {
        readonly dimensions?: string[]; // dimension value, e.g. read (for requestType)
        readonly metrics: number[][];
    }[];
    readonly data_lag: number;
    readonly min: Record<TMetric, number | undefined>;
    readonly max: Record<TMetric, number | undefined>;
    readonly totals: Record<TMetric, number | undefined>;
    readonly time_intervals: [ string, string ][]; // [ [ 2024-06-09T16:00:00Z, 2024-06-09T16:00:59Z ] ...
    readonly query: {
        readonly dimensions: TDimension[];
        readonly metrics: TMetric[];
        readonly since: string; // e.g. 2024-06-09T15:26:00Z
        readonly until: string;
        readonly time_delta: string; // e.g. minute, day
        readonly limit: number;
    }
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

// https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/domains/subresources/managed/methods/list/
export async function listR2EventNotificationRules(opts: { accountId: string, bucketName: string, apiToken: string }): Promise<R2EventNotificationRules>  {
    const { accountId, apiToken, bucketName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/event_notifications/r2/${bucketName}/configuration`;
    return (await execute<R2EventNotificationRules>('listR2EventNotificationRules', 'GET', url, apiToken)).result;
}

// https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/event_notifications/subresources/configuration/subresources/queues/methods/update/
export async function createR2EventNotificationRule(opts: { accountId: string, apiToken: string, bucketName: string, queueId: string, rules: EventNotificationRuleInput[] }): Promise<void>  {
    const { accountId, apiToken, bucketName, queueId, rules } = opts;
    const payload = { rules };
    const url = `${computeAccountBaseUrl(accountId)}/event_notifications/r2/${bucketName}/configuration/queues/${queueId}`;
    await execute('createR2EventNotificationRule', 'PUT', url, apiToken, payload);
    // 200 null
}

// https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/event_notifications/subresources/configuration/subresources/queues/methods/delete/
export async function deleteR2EventNotificationRule(opts: { accountId: string, apiToken: string, bucketName: string, queueId: string, ruleIds?: string[] }): Promise<void>  {
    const { accountId, apiToken, bucketName, queueId, ruleIds = [] } = opts;
    const payload = ruleIds.length > 0 ? { ruleIds } : undefined;
    const url = `${computeAccountBaseUrl(accountId)}/event_notifications/r2/${bucketName}/configuration/queues/${queueId}`;
    await execute('deleteR2EventNotificationRule', 'DELETE', url, apiToken, payload);
    // 200 null
}

export interface R2EventNotificationRules {
    readonly bucketName: string;
    readonly queues: QueueNotificationInfo[];
}

export interface QueueNotificationInfo {
    readonly queueId: string;
    readonly queueName: string;
    readonly rules: QueueRule[];
}

export interface QueueRule {
    readonly prefix: string; // blank if undefined
    readonly suffix: string; // blank if undefined
    readonly actions: R2EvenNotificationAction[];
    readonly ruleId: string; // resource id
    readonly createdAt: string; // e.g. 2025-01-11T18:13:44.518Z
}

export type R2EvenNotificationAction = 'PutObject' | 'CopyObject' | 'DeleteObject' | 'CompleteMultipartUpload' | 'LifecycleDeletion';

export interface EventNotificationRuleInput {
    /** Array of R2 object actions that will trigger notifications */
    readonly actions: R2EvenNotificationAction[];

    /** A description that can be used to identify the event notification rule after creation */
    readonly description?: string;

    /** Notifications will be sent only for objects with this prefix */
    readonly prefix?: string;

    /** Notifications will be sent only for objects with this suffix */
    readonly suffix?: string;
};

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

export async function getAccountDetails(opts: { accountId: string, apiToken: string }): Promise<User> {
    const { accountId, apiToken } = opts;
    const url = `${computeAccountBaseUrl(accountId)}`;
    return (await execute<User>('getAccountDetails', 'GET', url, apiToken)).result;
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

export interface CreateD1DatabaseResult extends D1Database {
    readonly primary_location_hint?: string; // e.g. "WNAM"
    readonly created_in_region?: string; // e.g. "WNAM"
}

export async function createD1Database(opts: { accountId: string, apiToken: string, databaseName: string, location?: string, experimentalBackend?: boolean }): Promise<CreateD1DatabaseResult> {
    const { accountId, apiToken, databaseName: name, location: primary_location_hint, experimentalBackend: experimental } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/d1/database`;
    return (await execute<CreateD1DatabaseResult>('createD1Database', 'POST', url, apiToken, { name, primary_location_hint, experimental })).result;
}

export async function getD1DatabaseMetadata(opts: { accountId: string, apiToken: string, databaseUuid: string }): Promise<D1DatabaseMetadata> {
    const { accountId, apiToken, databaseUuid } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/d1/database/${databaseUuid}`;
    return (await execute<D1DatabaseMetadata>('createD1Database', 'GET', url, apiToken)).result;
}

export interface D1DatabaseMetadata extends D1Database {
    readonly running_in_region: string; // e.g. WNAM
}

export async function listD1Databases(opts: { accountId: string, apiToken: string, name?: string }): Promise<readonly D1Database[]> {
    const { accountId, apiToken, name } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/d1/database`);
    if (typeof name === 'string') url.searchParams.set('name', name);
    return (await execute('listD1Databases', 'GET', url.toString(), apiToken) as ListD1DatabasesResponse).result;
}

export interface ListD1DatabasesResponse extends CloudflareApiResponse<readonly D1Database[]> {
    readonly result_info: ResultInfo;
}

export interface D1Database {
    readonly uuid: string; // dashed v4 guid
    readonly name: string;
    readonly version: string; // e.g. "alpha" or "beta" or "production"
    readonly created_at: string | null; // e.g. 2023-11-07T18:26:53.194Z
    readonly file_size: number | null; // in bytes
    readonly num_tables: number | null;
}

export async function deleteD1Database(opts: { accountId: string, apiToken: string, databaseUuid: string }): Promise<void> {
    const { accountId, apiToken, databaseUuid } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/d1/database/${databaseUuid}`;
    await execute('deleteD1Database', 'DELETE', url.toString(), apiToken);
    // 200 result: null
}

export async function queryD1Database(opts: { accountId: string, apiToken: string, databaseUuid: string, sql: string, params?: (null | boolean | number | string | ArrayBuffer)[] }): Promise<readonly D1QueryResult[]> {
    const { accountId, apiToken, databaseUuid, sql, params = [] } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/d1/database/${databaseUuid}/query`;
    const payload = { sql, params: params.length > 0 ? params : undefined };
    return (await execute<readonly D1QueryResult[]>('queryD1Database', 'POST', url, apiToken, payload)).result;
}

export interface D1QueryResult {
    readonly results: Record<string, unknown>[];
    readonly meta: D1QueryMetadata;
    readonly success: boolean;
}

export async function rawQueryD1Database(opts: { accountId: string, apiToken: string, databaseUuid: string, sql: string, params?: (null | boolean | number | string | ArrayBuffer)[] }): Promise<readonly D1RawQueryResult[]> {
    const { accountId, apiToken, databaseUuid, sql, params = [] } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/d1/database/${databaseUuid}/raw`;
    const payload = { sql, params: params.length > 0 ? params : undefined };
    return (await execute<readonly D1RawQueryResult[]>('rawQueryD1Database', 'POST', url, apiToken, payload)).result;
}

export interface D1RawQueryResult {
    readonly results: { columns: string[], rows: unknown[][] };
    readonly meta: D1QueryMetadata;
    readonly success: boolean;
}

export interface D1ExportOutput { 
    readonly filename: string; // e.g. <db-uuid>-00000005-00000000-00004dfd-213698e98028fe793208cae62b632474.sql
    readonly signed_url: string; // e.g. https://asdf.r2.cloudflarestorage.com/d1-sqlio-outgoing-prod/... expiring r2 url
};

export interface D1ExportResult {
    readonly at_bookmark?: string; // e.g. 00000005-00000000-00004ddd-213698e980d8fe793208cae62b632473
    readonly error?: string;
    readonly result?: D1ExportOutput;
    readonly status?: string; // e.g. complete, active, error
    readonly success: boolean;
    readonly type?: string; // e.g. export
    readonly messages?: string[];
}

export interface D1DumpOptions {
    readonly no_data?: boolean;
    readonly no_schema?: boolean;
    readonly tables?: string[];
} 

export async function exportD1Database(opts: { accountId: string, apiToken: string, databaseUuid: string, outputFormat?: 'polling', currentBookmark?: string, dumpOptions?: D1DumpOptions }): Promise<D1ExportOutput | D1ExportResult> {
    const { accountId, apiToken, databaseUuid, outputFormat: output_format, currentBookmark: current_bookmark, dumpOptions: dump_options } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/d1/database/${databaseUuid}/export`;
    const payload = { output_format, current_bookmark, dump_options };
    return (await execute<D1ExportResult>('exportD1Database', 'POST', url, apiToken, payload)).result;
}

export interface D1FinalImportResult {
    /** The time-travel bookmark if you need restore your D1 to directly after the import succeeded. */
    readonly final_bookmark: string;

    readonly meta: D1QueryMetadata;

    /** The total number of queries that were executed during the import. */
    readonly num_queries: number;
}

export interface D1ImportResult {
    /** The current time-travel bookmark for your D1, used to poll for updates. Will not change for the duration of the import. Only returned if an import process is currently running or recently finished. */
    readonly at_bookmark?: string; // (ingest, active)

    /** Only present when status = 'error'. Contains the error message that prevented the import from succeeding. */
    readonly error?: string;

    /** Derived from the database ID and etag, to use in avoiding repeated uploads. Only returned when for the 'init' action. */
    readonly filename?: string; // (init)

    /** Logs since the last time you polled */
    readonly messages?: string[]; // (ingest, active)

    /** Only present when status = 'complete' */
    readonly result?: D1FinalImportResult; // (ingest)

    readonly status: string; // (ingest, active) complete or error

    readonly success: boolean; // (init, ingest, active)

    readonly type: string; // (ingest, active) "import"
    
    /** The R2 presigned URL to use for uploading. Only returned when for the 'init' action. */
    readonly upload_url?: string; // (init)
}

export type D1ImportAction = {
    /** Indicates you have a new SQL file to upload. */
    action: 'init',
    /** An md5 hash of the file you're uploading. Used to check if it already exists, and validate its contents before ingesting. */
    etag: string | undefined,
} | {
    /** Indicates you've finished uploading to tell the D1 to start consuming it */
    action: 'ingest',
    /** An md5 hash of the file you're uploading. Used to check if it already exists, and validate its contents before ingesting. */
    etag: string | undefined,
    /** The filename you have successfully uploaded. */
    filename: string,
} | {
    /** Indicates you've finished uploading to tell the D1 to start consuming it */
    action: 'poll',
    /** This identifies the currently-running import, checking its status. */
    current_bookmark: string,
};

export async function importIntoD1Database(opts: { accountId: string, apiToken: string, databaseUuid: string, action: D1ImportAction }): Promise<D1ImportResult> {
    const { accountId, apiToken, databaseUuid, action } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/d1/database/${databaseUuid}/import`;
    const payload = action;
    return (await execute<D1ImportResult>('importIntoD1Database', 'POST', url, apiToken, payload)).result;
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

export interface D1TimeTravelBookmarkResult {
    readonly bookmark: string;
}

export async function getD1TimeTravelBookmark(opts: { accountId: string, apiToken: string, databaseUuid: string, timestamp?: string }): Promise<D1TimeTravelBookmarkResult> {
    const { accountId, apiToken, databaseUuid, timestamp } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/d1/database/${databaseUuid}/time_travel/bookmark`);
    if (timestamp !== undefined) url.searchParams.set('timestamp', timestamp);
    return (await execute<D1TimeTravelBookmarkResult>('getD1TimeTravelBookmark', 'GET', url.toString(), apiToken)).result;
}

export interface D1TimeTravelRestoreResult {
    readonly bookmark: string;
    readonly previous_bookmark: string;
    readonly message: string; // e.g. Resetting Durable Object to restore database to bookmark: <bookmark>
}

export async function restoreD1TimeTravel(opts: { accountId: string, apiToken: string, databaseUuid: string, bookmark?: string, timestamp?: string }): Promise<D1TimeTravelRestoreResult> {
    const { accountId, apiToken, databaseUuid, bookmark, timestamp } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/d1/database/${databaseUuid}/time_travel/restore`);
    if (bookmark !== undefined) url.searchParams.set('bookmark', bookmark);
    if (timestamp !== undefined) url.searchParams.set('timestamp', timestamp);
    return (await execute<D1TimeTravelRestoreResult>('restoreD1TimeTravel', 'POST', url.toString(), apiToken)).result;
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

// https://developers.cloudflare.com/api/resources/queues/methods/list/
export async function listQueues(opts: { accountId: string, apiToken: string, page?: number }): Promise<Queue[]> {
    const { accountId, apiToken, page } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/queues`);
    if (typeof page === 'number') url.searchParams.set('page', page.toString());
    return (await execute<Queue[]>('listQueues', 'GET', url.toString(), apiToken)).result;
}

// https://developers.cloudflare.com/api/resources/queues/methods/get/
export async function getQueue(opts: { accountId: string, apiToken: string, queueId: string }): Promise<Queue> {
    const { accountId, apiToken, queueId } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/queues/${queueId}`;
    return (await execute<Queue>('getQueue', 'GET', url.toString(), apiToken)).result;
}

// https://developers.cloudflare.com/api/resources/queues/methods/delete/
export async function deleteQueue(opts: { accountId: string, apiToken: string, queueId: string }): Promise<void> {
    const { accountId, apiToken, queueId } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/queues/${queueId}`;
    await execute('deleteQueue', 'DELETE', url.toString(), apiToken);
    // 200 result: null
}

// https://developers.cloudflare.com/api/resources/queues/methods/create/
export async function createQueue(opts: { accountId: string, apiToken: string, queueName: string }): Promise<NewQueue> {
    const { accountId, apiToken, queueName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/queues`;
    const payload = { queue_name: queueName };
    return (await execute<NewQueue>('createQueue', 'POST', url, apiToken, payload)).result;
}

// https://developers.cloudflare.com/api/resources/queues/methods/update/
export async function updateQueue(opts: { accountId: string, apiToken: string, queueId: string, queueName?: string, deliveryDelay?: number, messageRetentionPeriod?: number }): Promise<NewQueue> {
    const { accountId, apiToken, queueId, queueName, deliveryDelay, messageRetentionPeriod } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/queues/${queueId}`;
    const payload = { queue_name: queueName, settings: { delivery_delay: deliveryDelay, message_retention_period: messageRetentionPeriod } };
    return (await execute<Queue>('updateQueue', 'PUT', url, apiToken, payload)).result;
}

// https://developers.cloudflare.com/api/resources/queues/subresources/consumers/methods/create/
export async function createQueueConsumer(opts: { accountId: string, apiToken: string, queueId: string, consumer: NewQueueConsumer }): Promise<QueueConsumer> {
    const { accountId, apiToken, queueId, consumer } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/queues/${queueId}/consumers`;
    return (await execute<QueueConsumer>('createQueueConsumer', 'POST', url, apiToken, consumer as unknown as Record<string, unknown>)).result;
}

// https://developers.cloudflare.com/api/resources/queues/subresources/consumers/methods/get/
export async function listQueueConsumers(opts: { accountId: string, apiToken: string, queueId: string }): Promise<QueueConsumer[]> {
    const { accountId, apiToken, queueId } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/queues/${queueId}/consumers`;
    return (await execute<QueueConsumer[]>('listQueueConsumers', 'GET', url, apiToken)).result;
}

// https://developers.cloudflare.com/api/resources/queues/subresources/consumers/methods/update/
export async function updateQueueConsumer(opts: { accountId: string, apiToken: string, queueId: string, consumerId: string, consumer: NewQueueConsumer }): Promise<QueueConsumer> {
    const { accountId, apiToken, queueId, consumerId, consumer } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/queues/${queueId}/consumers/${consumerId}`;
    return (await execute<QueueConsumer>('updateQueueConsumer', 'PUT', url, apiToken, consumer as unknown as Record<string, unknown>)).result;
}

// https://developers.cloudflare.com/api/resources/queues/subresources/consumers/methods/delete/
export async function deleteQueueConsumer(opts: { accountId: string, apiToken: string, queueId: string, consumerId: string }): Promise<void> {
    const { accountId, apiToken, queueId, consumerId } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/queues/${queueId}/consumers/${consumerId}`;
    await execute<QueueConsumer>('deleteQueueConsumer', 'DELETE', url, apiToken);
    // 200 result: null
}

// https://developers.cloudflare.com/api/resources/queues/subresources/messages/methods/pull/
export async function pullQueueMessages(opts: { accountId: string, apiToken: string, queueId: string, visibilityTimeoutMillis?: number, batchSize?: number }): Promise<PullQueueMessagesResponse> {
    const { accountId, apiToken, queueId, visibilityTimeoutMillis, batchSize } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/queues/${queueId}/messages/pull`;
    const payload = { 
        ...(visibilityTimeoutMillis !== undefined ? { visibility_timeout_ms: visibilityTimeoutMillis } : {}), 
        ...(batchSize !== undefined ? { batch_size: batchSize } : {}),
    };
    return (await execute<PullQueueMessagesResponse>('pullQueueMessages', 'POST', url, apiToken, payload)).result;
}

// https://developers.cloudflare.com/api/resources/queues/subresources/messages/methods/ack/
export async function ackQueueMessages(opts: { accountId: string, apiToken: string, queueId: string, acks: { leaseId: string }[], retries: { leaseId: string, delaySeconds?: number}[] }): Promise<AckQueueMessagesResponse> {
    const { accountId, apiToken, queueId, acks, retries } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/queues/${queueId}/messages/ack`;
    const payload = { acks: acks.map(v => ({ lease_id: v.leaseId })), retries: retries.map(v => ({ lease_id: v.leaseId, delay_seconds: v.delaySeconds })) };
    return (await execute<AckQueueMessagesResponse>('ackQueueMessages', 'POST', url, apiToken, payload)).result;
}

// undocumented
export async function previewQueueMessages(opts: { accountId: string, apiToken: string, queueId: string, batchSize?: number }): Promise<PreviewQueueMessagesResponse> {
    const { accountId, apiToken, queueId, batchSize } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/queues/${queueId}/messages/preview`;
    const payload = { 
        ...(batchSize !== undefined ? { batch_size: batchSize } : {}),
    };
    return (await execute<PreviewQueueMessagesResponse>('previewQueueMessages', 'POST', url, apiToken, payload)).result;
}

// https://developers.cloudflare.com/api/resources/queues/subresources/messages/methods/push/
export async function sendQueueMessage(opts: { accountId: string, apiToken: string, queueId: string, message: QueueMessagePayload }): Promise<void> {
    const { accountId, apiToken, queueId, message } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/queues/${queueId}/messages`;
    await execute('sendQueueMessage', 'POST', url, apiToken, message);
    // 200 result: null
}

// https://developers.cloudflare.com/api/resources/queues/subresources/messages/methods/bulk_push/
export async function sendQueueMessageBatch(opts: { accountId: string, apiToken: string, queueId: string, batch: QueueMessageBatchPayload }): Promise<void> {
    const { accountId, apiToken, queueId, batch } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/queues/${queueId}/messages/batch`;
    await execute('sendQueueMessageBatch', 'POST', url, apiToken, batch);
    // 200 result: null
}

export type QueueMessageBatchPayload = {
    /** The number of seconds to wait for attempting to deliver this batch to consumers */
    delay_seconds?: number,
    
    messages: QueueMessagePayload[],
}

export type QueueMessagePayload = {
    content_type: 'text',
    body: string,
    delay_seconds?: number,
} | {
    content_type: 'json',
    body: unknown,
    delay_seconds?: number,
}

export interface NewQueue {
    readonly queue_id: string; // e.g. b15f3af7f12d497b97a64548e6dd716e
    readonly queue_name: string;
    readonly created_on: string; // 2022-10-30T16:05:14.966372Z
    readonly modified_on: string; // 2022-10-30T16:05:14.966372Z
    readonly settings: {
        /** Number of seconds to delay delivery of all messages to consumers. */
        readonly delivery_delay?: number | null;

        /** Number of seconds after which an unconsumed message will be delayed. */
        readonly message_retention_period?: number | null;
    };
}

export interface Queue extends NewQueue {
    readonly producers_total_count: number;
    readonly producers: QueueProducer[];
    readonly consumers_total_count: number;
    readonly consumers: QueueConsumer[];
}

export type QueueProducer = WorkerQueueProducer | R2BucketQueueProducer;

export interface WorkerQueueProducer {
    readonly type: 'worker';
    readonly script: string;
}

export interface R2BucketQueueProducer {
    readonly type: 'r2_bucket';
    readonly bucket_name: string;
}

export type QueueConsumer = WorkerQueueConsumer | HttpPullQueueConsumer;

export type NewQueueConsumer = NewWorkerQueueConsumer | NewHttpPullQueueConsumer;

interface BaseQueueConsumer {
    readonly consumer_id: string; // A Resource identifier.
    readonly created_on: string; // 2022-10-30T16:38:22.373479Z
    readonly queue_id: string; // A Resource identifier. (missing on initial create?)
    readonly queue_name: string;
    readonly dead_letter_queue?: string;
}
export interface WorkerQueueConsumer extends BaseQueueConsumer {
    readonly type: 'worker';
    readonly script?: string;
    readonly settings: WorkerQueueConsumerSettings;
}

export interface NewWorkerQueueConsumer {
    readonly type: 'worker';
    readonly script?: string;
    readonly dead_letter_queue?: string;
    readonly settings?: WorkerQueueConsumerSettings;
}

export interface WorkerQueueConsumerSettings {
    /** The maximum number of messages allowed in each batch. */
    readonly batch_size?: number; // default: 10

    /** The maximum number of retries for a message, if it fails or retryAll() is invoked. */
    readonly max_retries?: number; // default: 3

    /** The maximum number of millis to wait until a batch is full (max: 30 seconds). */
    readonly max_wait_time_ms?: number; // default: 5000

    /** If present, the maximum concurrent consumer invocations (between 1 and 20) */
    readonly max_concurrency?: number | null;

    /** The number of seconds to delay before making the message available for another attempt. */
    readonly retry_delay?: number | null;
}

export interface HttpPullQueueConsumer extends BaseQueueConsumer {
    readonly type: 'http_pull';
    readonly settings: HttpPullQueueConsumerSettings;
}

export interface NewHttpPullQueueConsumer {
    readonly type: 'http_pull';
    readonly dead_letter_queue?: string;
    readonly settings?: HttpPullQueueConsumerSettings;
}

export interface HttpPullQueueConsumerSettings {
    /** The maximum number of messages allowed in each batch. */
    readonly batch_size?: number; // default: 10

    /** The maximum number of retries. */
    readonly max_retries?: number; // default: 3

    /** The number of seconds to delay before making the message available for another attempt. */
    readonly retry_delay?: number | null;

    /** The number of milliseconds that a message is exclusively leased. After the timeout, the message becomes available for another attempt */
    readonly visibility_timeout_ms?: number;
}

export interface PullQueueMessagesResponse {
    readonly message_backlog_count: number;
    readonly messages: readonly QueueMessage[];
}

export interface QueueMessage {
    readonly id: string; // e.g. eb868d636bc0dc7b448f8192410573c7
    readonly timestamp_ms: number; // e.g. 1736608302662
    readonly body: string;
    readonly attempts: number; // e.g. 1
    readonly metadata?: Record<string, string>; // e.g. { "CF-Content-Type": "json", "CF-msg-delay-secs": "20", "CF-sourceMessageSource": "api" }
    readonly lease_id: string;
}

export interface AckQueueMessagesResponse {
    readonly ackCount: number;
    readonly retryCount: number;
    readonly warnings: Record<string, string>; // { leaseId: warning }
    readonly errors?: string[];
}

export interface PreviewQueueMessagesResponse {
    readonly messages: readonly QueueMessage[];
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

//#region Intel

export async function getAsnOverview(opts: { accountId: string, apiToken: string, asn: number }): Promise<AsnOverview> {
    // https://developers.cloudflare.com/api/operations/asn-intelligence-get-asn-overview
    const { accountId, apiToken, asn } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/intel/asn/${asn}`);
    return (await execute<AsnOverview>('getAsnOverview', 'GET', url.toString(), apiToken)).result;
}

export interface AsnOverview {
    readonly asn: number;
    readonly description: string;
    readonly country: string;
    readonly type: string;
    readonly domain_count: number;
    readonly top_domains: readonly string[];
}

//#endregion

//#region Radar

export async function getAsns(opts: { apiToken: string, asns: number[] }): Promise<GetAsnsResponse> {
    // https://developers.cloudflare.com/api/operations/radar_get_ha
    const { apiToken, asns } = opts;
    const url = new URL(`${computeBaseUrl()}/radar/entities/asns`);
    url.searchParams.set('asn', asns.join(','));
    return (await execute<GetAsnsResponse>('getAsns', 'GET', url.toString(), apiToken)).result;
}

export interface GetAsnsResponse {
    readonly asns: readonly Asn[];
}

export interface Asn {
    readonly name: string;
    readonly nameLong: string;
    readonly aka: string;
    readonly asn: number;
    readonly website: string;
    readonly country: string;
    readonly countryName: string;
    readonly orgName: string;
}

//#endregion

//#region AI

export interface AiModel {
    readonly id: string; // e.g. 429b9e8b-d99e-44de-91ad-706cf8183658
    readonly source: number; // e.g. 1
    readonly task: {
        readonly id: string; // e.g. 0137cdcf-162a-4108-94f2-1ca59e8c65ee
        readonly name: string; // e.g. Text Embeddings
        readonly description: string | null;
    },
    readonly tags: unknown[];
    readonly name: string; // e.g. @cf/baai/bge-base-en-v1.5
    readonly description: string | null;
}

export async function listAiModels(opts: { accountId: string, apiToken: string, page?: number, perPage?: number }): Promise<AiModel[]> {
    const { accountId, apiToken, page, perPage } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/ai/models/search`);
    if (typeof page === 'number') url.searchParams.set('page', page.toString());
    if (typeof perPage === 'number') url.searchParams.set('per_page', perPage.toString());
    return (await execute<AiModel[]>('listAiModels', 'GET', url.toString(), apiToken)).result;
}

export async function runAiModel(opts: { apiToken: string, accountId: string, modelId: string, input: AiModelInput, responseType?: 'json' | 'bytes' | 'sse' }): Promise<AiModelOutput> {
    const { apiToken, accountId, modelId, input, responseType } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/ai/run/${modelId}`;
    if (responseType === 'sse') return await execute('runAiModel', 'POST', url.toString(), apiToken, input, 'sse', APPLICATION_JSON);
    if (responseType === 'bytes') return await execute('runAiModel', 'POST', url.toString(), apiToken, input, 'bytes', APPLICATION_JSON);
    return (await execute<AiModelOutput>('runAiModel', 'POST', url.toString(), apiToken, input, responseType, APPLICATION_JSON)).result;
}

//#endregion

//#region Hyperdrive

export async function listHyperdriveConfigs(opts: { accountId: string, apiToken: string }): Promise<HyperdriveConfig[]> {
    const { accountId, apiToken } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/hyperdrive/configs`);
    return (await execute<HyperdriveConfig[]>('listHyperdriveConfigs', 'GET', url.toString(), apiToken)).result;
}

export interface HyperdriveCachingOpts {
    readonly disabled?: boolean;
    readonly maxAge?: number;
    readonly staleWhileRevalidate?: number;
}

export interface HyperdriveOrigin {
    readonly host: string;
    readonly port: number;
    readonly database: string;
    readonly user: string;
}

export interface HyperdriveOriginInput extends HyperdriveOrigin {
    readonly scheme: string;
    readonly password: string;
}

export interface HyperdriveConfig {
    readonly id: string; // 32-char hex
    readonly name: string;
    readonly origin: HyperdriveOrigin;
    readonly caching: HyperdriveCachingOpts;
}

export async function createHyperdriveConfig(opts: { accountId: string, apiToken: string, name: string, origin: HyperdriveOriginInput, caching: HyperdriveCachingOpts }): Promise<HyperdriveConfig> {
    const { accountId, apiToken, ...body } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/hyperdrive/configs`;
    return (await execute<HyperdriveConfig>('createHyperdriveConfig', 'POST', url, apiToken, body)).result;
}

export async function updateHyperdriveConfig(opts: { accountId: string, apiToken: string, id: string, name?: string, origin: Partial<HyperdriveOriginInput>, caching?: HyperdriveCachingOpts }): Promise<HyperdriveConfig> {
    const { accountId, apiToken, id, ...body } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/hyperdrive/configs/${id}`;
    return (await execute<HyperdriveConfig>('updateHyperdriveConfig', 'PUT', url, apiToken, body)).result;
}

export async function deleteHyperdriveConfig(opts: { accountId: string, apiToken: string, id: string }): Promise<void> {
    const { accountId, apiToken, id } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/hyperdrive/configs/${id}`);
    await execute<null>('deleteHyperdriveConfig', 'DELETE', url.toString(), apiToken);
}

//#endregion

//#region Rulesets

// https://developers.cloudflare.com/api/operations/listZoneRulesets
export interface Ruleset {
    readonly id: string; // 32-char hex
    readonly name: string;
    readonly description: string;
    readonly source?: string; // firewall_custom, firewall_managed
    readonly kind: string; // managed, custom, root, zone
    readonly version: string; // e.g. "56"
    readonly last_updated: string; // e.g. 2023-10-11T14:34:33.86359Z
    readonly phase: string; // ddos_l4 ddos_l7 http_config_settings http_custom_errors http_log_custom_fields http_ratelimit http_request_cache_settings http_request_dynamic_redirect http_request_firewall_custom http_request_firewall_managed http_request_late_transform http_request_origin http_request_redire http_request_sanitize http_request_sbfm http_request_select_configuration http_request_transform http_response_compression http_response_firewall_managed http_response_headers_transform  magic_transit magic_transit_ids_managed magic_transit_managed
}

export async function listZoneRulesets(opts: { zoneId: string, apiToken: string }): Promise<Ruleset[]> {
    const { zoneId, apiToken } = opts;
    const url = new URL(`${computeBaseUrl()}/zones/${zoneId}/rulesets`);
    return (await execute<Ruleset[]>('listZoneRulesets', 'GET', url.toString(), apiToken)).result;
}

// https://developers.cloudflare.com/api/operations/updateZoneEntrypointRuleset
export interface Rule {
    readonly action: string; // e.g. serve_error
    readonly action_parameters: Record<string, string>; // e.g. { content: 'not found', content_type: 'text/plain', status_code: 503 }
    readonly expression: string; // e.g. http.response.code eq 500
    readonly enabled: boolean;
}

export async function updateZoneEntrypointRuleset(opts: { zoneId: string, apiToken: string, rulesetPhase: string, rules: Rule[]}): Promise<unknown> {
    const { zoneId, apiToken, rulesetPhase, rules } = opts;
    const url = `${computeBaseUrl()}/zones/${zoneId}/rulesets/phases/${rulesetPhase}/entrypoint`;
    return (await execute<unknown>('updateZoneEntrypointRuleset', 'PUT', url, apiToken, { rules })).result;
}

//#endregion

//#region Observability

type Filter = {
    key: string, // e.g. $baselime.service
    type: string, // e.g. string
    value: string, // e.g. my-worker-name
    operation: string, // e.g. =
};

export type ObservabilityTelemetryQuery = {
    dry?: boolean,
    limit?: number, // e.g. 20  (default: 50)
    view?: string, // e.g. events
    queryId: string, // e.g. test-query
    timeframe: { from: number /* oldest */, to: number /* newest */ }, // epoch millis
    parameters: {
        datasets?: string[], // e.g. cloudflare-workers
        filters?: Filter[],
        needle?: {
            value: string, // e.g. my search term
        }
    },
};

type Statistics = {
    elapsed: number,
    rows_read: number,
    bytes_read: number,
};

export type ObservabilityTelemetryQueryResult = {
    message: string, // e.g. Successful request
    data: {
        previous: unknown,
        events: {
            events: unknown[],
            fields: unknown[],
            count: number,
            series: unknown[],
        },
        patterns: unknown,
        queryRun: {
            id: string,
            query: unknown,
            workspaceId: string,
            environmentId: string,
            timeframe: { from: number, to: number },
            userId: string,
            status: string,
            granularity: number,
            dry?: boolean,
            statistics: Statistics,
        },
        statistics: Statistics,
    }
};

export async function observabilityTelemetryQuery(opts: { accountId: string, apiToken: string, query: ObservabilityTelemetryQuery }): Promise<ObservabilityTelemetryQueryResult> {
    const { accountId, apiToken, query } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/observability/telemetry/query-run`;
    return (await execute<ObservabilityTelemetryQueryResult>('observabilityTelemetryQuery', 'POST', url, apiToken, query, 'json', undefined, { nonStandardResponse: true })).result;
}

export type ObservabilityTelemetryKeysRequest = {
    datasets?: string[], // e.g. cloudflare-workers
    filters?: Filter[],
    from: number, // epoch millis, oldest
    to: number, // epoch millis, newest
    limit?: number, // e.g. 100
};

type TypedKeys = {
    keys: string[], // e.g. "$cloudflare.event.cron", "$cloudflare.scriptName"
    type: string, // e.g. string
    dataset: string, // e.g. cloudflare-workers
};

export type ObservabilityTelemetryKeysResult = {
    message: string, // e.g. Successful request
    keys: TypedKeys[],
};

export async function observabilityTelemetryKeys(opts: { accountId: string, apiToken: string, request: ObservabilityTelemetryKeysRequest }): Promise<ObservabilityTelemetryKeysResult> {
    const { accountId, apiToken, request } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/observability/telemetry/keys`;
    return (await execute<ObservabilityTelemetryKeysResult>('observabilityTelemetryKeys', 'POST', url, apiToken, request, 'json', undefined, { nonStandardResponse: true })).result;
}

//#endregion

//#region Pipelines

export async function listPipelines(opts: { accountId: string, apiToken: string }): Promise<PipelineInfo[]> {
    const { accountId, apiToken } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/pipelines`;
    return (await execute<PipelineInfo[]>('listPipelines', 'GET', url, apiToken)).result;
}

export async function getPipeline(opts: { accountId: string, apiToken: string, pipelineName: string }): Promise<Pipeline> {
    const { accountId, apiToken, pipelineName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/pipelines/${pipelineName}`;
    return (await execute<Pipeline>('getPipeline', 'GET', url, apiToken)).result;
}

export async function createPipeline(opts: { accountId: string, apiToken: string, config: PipelineConfig }): Promise<Pipeline> {
    const { accountId, apiToken, config } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/pipelines`;
    return (await execute<Pipeline>('createPipeline', 'POST', url, apiToken, config)).result;
}

export async function updatePipeline(opts: { accountId: string, apiToken: string, config: PipelineConfigUpdate }): Promise<Pipeline> {
    const { accountId, apiToken, config } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/pipelines/${config.name}`;
    return (await execute<Pipeline>('updatePipeline', 'PUT', url, apiToken, config)).result;
}

export async function deletePipeline(opts: { accountId: string, apiToken: string, pipelineName: string }): Promise<void> {
    const { accountId, apiToken, pipelineName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/pipelines/${pipelineName}`;
    await execute('deletePipeline', 'DELETE', url, apiToken);
    // 200 {}
}

export type HttpPipelineSource = {
    readonly type: 'http';
    readonly format: string;
    readonly schema?: string;
    /** Require authentication (Cloudflare API Token) to send data to the HTTPS endpoint */
    readonly authentication?: boolean;
}

export type BindingPipelineSource = {
    readonly type: 'binding';
    readonly format: string;
    readonly schema?: string;
}

export type PipelineSource = HttpPipelineSource | BindingPipelineSource;

export type PipelineTransformConfig = {
    readonly script: string;
    readonly entrypoint: string;
}

export type PipelineCompressionType = 'none' | 'gzip' | 'deflate';

export type PipelineConfig = {
    readonly name: string;
    readonly metadata: Record<string, string>;
    readonly source: PipelineSource[];
    /** The worker and entrypoint of the PipelineTransform implementation in the format "worker.entrypoint" */
    readonly transforms: PipelineTransformConfig[];
    readonly destination: {
        readonly type: string;
        readonly format: string;
        readonly compression: {
            /** Sets the compression format of output files (default: gzip) */
            readonly type: PipelineCompressionType;
        };
        readonly batch: {
            /** The approximate maximum age (in seconds) of a batch before flushing (range: 1 - 300) */
            readonly max_duration_s?: number;
            /** The approximate maximum size for each batch before flushing (range: 1mb - 100mb, default: 100mb) */
            readonly max_bytes?: number;
            /** The approximate maximum number of rows in a batch before flushing (range: 100 - 10_000_000, default: 10_000_000) */
            readonly max_rows?: number;
        };
        readonly path: {
            readonly bucket: string;
            /** Optional base path to store files in the destination bucket */
            readonly prefix?: string;
            /** The path to store partitioned files in the destination bucket. (default: event_date=${date}/hr=${hr}) */
            readonly filepath?: string;
            /** The name of each unique file in the bucket. Must contain "${slug}". File extension is optional. (default: ${slug}${extension}) */
            readonly filename?: string;
        };
        readonly credentials: {
            readonly endpoint: string;
            readonly secret_access_key: string;
            readonly access_key_id: string;
        };
    };
}

// https://stackoverflow.com/a/51365037
type RecursivePartial<T> = {
    [P in keyof T]?:
      T[P] extends (infer U)[] ? RecursivePartial<U>[] :
      T[P] extends object | undefined ? RecursivePartial<T[P]> :
      T[P];
};

export type PipelineConfigUpdate = RecursivePartial<PipelineConfig> & Pick<PipelineConfig, 'name'>;

export type Pipeline = Omit<PipelineConfig, 'destination'> & {
    readonly id: string; // resource id
    readonly version: number; // e.g. 1
    readonly endpoint?: string; // e.g. https://${pipelineId}.pipelines.cloudflare.com
    readonly destination: Omit<PipelineConfig['destination'], 'credentials'>;
}

export type PipelineInfo = Pick<Pipeline, 'id' | 'name' | 'endpoint'>;

//#endregion

//#region Containers

export async function listContainersApplications(opts: { accountId: string, apiToken: string, name?: string, image?: string, labels?: string[] }): Promise<ContainersApplication[]> {
    const { accountId, apiToken, name, image, labels } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/containers/applications`);
    if (typeof name === 'string') url.searchParams.set('name', name);
    if (typeof image === 'string') url.searchParams.set('image', image);
    if (labels) labels.forEach(v => url.searchParams.append('label', v));
    return (await execute<ContainersApplication[]>('listContainersApplications', 'GET', url.toString(), apiToken)).result;
}

export type ContainersApplicationSchedulingPolicy = 'moon' | 'gpu' | 'regional' | 'fill_metals' | 'default';

type ContainersSecretDef = {
    name: string, // name of secret within container
    type: 'env',
    secret: string, // secret name from the account
}

type NameValuePair = {
    name: string,
    value: string,
}

export type ContainersDisk = {
    size: ByteUnits, // min 512MB
    size_mb?: number,
}

type ContainersDnsConfig = {
    servers?: string[], // max 3
    searches?: string[], // max 6
}

type ContainersDeploymentCheck = {
    name?: string,
    type: 'tcp' | 'http',
    tls?: boolean,
    port: string,
    http?: {
        method?: string,
        body?: string,
        path?: string,
        headers?: Record<string, unknown>,
    },
    interval: Duration,
    timeout: Duration;
    attempts_before_failure?: number,
    kind: 'health' | 'ready',
    grace_period?: Duration,
}

type ContainersObservability = {
    logs?: {
        enabled?: boolean,
    }
}

export type ContainersApplicationConfiguration = {
    image: string, // e.g. <registry-host>/<image-name>:<tag>
    vcpu?: number,
    memory?: ByteUnits, // min 128MB
    memory_mib?: number,
    disk?: ContainersDisk,
    environment_variables?: NameValuePair[],
    network?: {
        assign_ipv4?: IpAssignment,
        assign_ipv6?: IpAssignment,
        mode?: 'public' | 'private' | 'public-by-port', // public: assigned at least an IPv6, and an IPv4 if "assign_ipv4": true. public-by-port: same, but constrain to one or more ports. private: no accessible public IPs, however it will be able to access the internet.
    },
    runtime?: string, // e.g. firecracker
    command?: string[],
    entrypoint?: string[],
    ssh_public_key_ids?: string[], // ssh public key ids
    secrets?: ContainersSecretDef[],
    instance_type?: string, // dev, basic, standard
    labels?: NameValuePair[],
    dns?: ContainersDnsConfig,
    ports?: {
        name: string,
        port?: number,
        assign_port?: { start: number, end: number }[], // inclusive ranges
    }[],
    checks?: ContainersDeploymentCheck[],
    provisioner?: 'none' | 'cloudinit',
    observability?: ContainersObservability,
};

type ContainersApplicationCommon = {
    instances?: number,
    max_instances?: number,
    affinities?: {
        colocation?: 'datacenter',
    },
    priorities?: {
        default: number;
    },
    constraints?: {
        region?: string,
        tier?: number,
        regions?: string[],
        cities?: string[], // city code like MAD
        pops?: string[], // requires specific entitlements
    },
}

export type ContainersApplicationInput = ContainersApplicationCommon & {
    name: string,
    configuration: ContainersApplicationConfiguration,
    scheduling_policy: ContainersApplicationSchedulingPolicy,
    jobs?: boolean,
    durable_objects?: {
        namespace_id: string,
    },
}

export type ContainersApplicationUpdate = ContainersApplicationCommon & {
    scheduling_policy?: ContainersApplicationSchedulingPolicy,
    configuration?: Partial<ContainersApplicationConfiguration>,
}

export type ContainersApplication = ContainersApplicationInput & {
    id: string, // guid
    created_at: string, // e.g. 2025-04-13T17:55:33.886000128Z
    account_id: string,
    version: number, // starts at 1
    runtime: string, // 'firecracker'
    instances: number,
    scheduling_hint?: {
        current: {
            instances: number,
            configuration: ContainersApplicationConfiguration,
            version: number,
        };
        target: {
            instances: number,
            configuration: ContainersApplicationConfiguration,
            version: number,
        };
    },
    active_rollout_id?: string,
    health?: {
        instances: {
            durable_objects_active: number,
            healthy: number,
            failed: number,
            starting: number,
            scheduling: number,
        },
    },
}

export async function getContainersApplication(opts: { accountId: string, apiToken: string, applicationId: string }): Promise<ContainersApplication> {
    const { accountId, apiToken, applicationId } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/containers/applications/${applicationId}`;
    return (await execute<ContainersApplication>('getContainersApplication', 'GET', url, apiToken)).result;
}

export async function createContainersApplication(opts: { accountId: string, apiToken: string, input: ContainersApplicationInput }): Promise<ContainersApplication> {
    const { accountId, apiToken, input } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/containers/applications`;
    return (await execute<ContainersApplication>('createContainersApplication', 'POST', url, apiToken, input)).result;
}

export async function deleteContainersApplication(opts: { accountId: string, apiToken: string, applicationId: string }): Promise<void> {
    const { accountId, apiToken, applicationId } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/containers/applications/${applicationId}`;
    await execute('deleteContainersApplication', 'DELETE', url, apiToken);
}

export async function updateContainersApplication(opts: { accountId: string, apiToken: string, applicationId: string, input: ContainersApplicationUpdate }): Promise<ContainersApplication> {
    const { accountId, apiToken, applicationId, input } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/containers/applications/${applicationId}`;
    return (await execute<ContainersApplication>('updateContainersApplication', 'PATCH', url, apiToken, input)).result;
}

type IpAssignment = 'none' | 'predefined' | 'account';

type Duration = 'string'; //  in the form "3d1h3m". Leading zero units are omitted. As a special case, durations less than one second format use a smaller unit (milli-, micro-, or nanoseconds) to ensure that the leading digit is non-zero.

export async function getContainersCustomer(opts: { accountId: string, apiToken: string }): Promise<ContainersCustomer> {
    const { accountId, apiToken } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/containers/me`;
    return (await execute<ContainersCustomer>('getContainersCustomer', 'GET', url, apiToken)).result;
}

export type ByteUnits = `${number}${'MB' | 'GB'}`; // e.g. 2GB or 40GB

type ContainersNodeGroup = 'metal' | 'cloudchamber';
type ContainersNetworkMode = 'uso' | 'vhost' | 'xdp';

export type ContainersCustomer = {
    account_id: string, // cf account id
    external_account_id: string, // cf account id
    legacy_identity: string, // "<email>'s Account"
    capabilities: string[], // e.g. CLOUDFLARE_REGISTRY, V3_ONLY_ACCOUNT, DURABLE_OBJECTS, PIPEFITTER, PRIVATE_NETWORK_ONLY, THROTTLED_EGRESS, REQUIRE_INSTANCE_TYPE
    limits: {
        account_id: string, // cf account id
        vcpu_per_deployment: number,
        memory_mib_per_deployment: number,
        memory_per_deployment: ByteUnits,
        disk_per_deployment: ByteUnits,
        disk_mb_per_deployment: number,
        total_vcpu: number,
        total_memory: ByteUnits,
        total_memory_mib: number,
        ipv4s: number,
        network_modes: ContainersNetworkMode[],
        node_group: ContainersNodeGroup,
    },
    defaults: {
        vcpus: number,
        memory: ByteUnits,
        memory_mib: number,
        disk_mb: number,
    },
    locations: unknown[],
}

export type ContainersImageRegistryCredentialPermission = 'push' | 'pull';

export const CLOUDFLARE_MANAGED_REGISTRY = 'registry.cloudflare.com';

export async function generateContainersImageRegistryCredentials(opts: { accountId: string, apiToken: string, expiration_minutes: number, permissions: ContainersImageRegistryCredentialPermission[], domain?: string  }): Promise<ContainersImageRegistryCredentials> {
    const { accountId, apiToken, expiration_minutes, permissions, domain = CLOUDFLARE_MANAGED_REGISTRY } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/containers/registries/${domain}/credentials`;
    return (await execute<ContainersImageRegistryCredentials>('generateContainersImageRegistryCredentials', 'POST', url, apiToken, { expiration_minutes, permissions })).result;
}

export type ContainersImageRegistryCredentials = {
    account_id: string,
    registry_host: string,
    username: string,
    password?: string,  // undefined if public
}

export type ContainersImageRegistryConfig = {
    domain: string, // hostname
    is_public?: boolean, // true for docker.io
}

export async function createContainersImageRegistry(opts: { accountId: string, apiToken: string, config: ContainersImageRegistryConfig }): Promise<ContainersImageRegistry> {
    const { accountId, apiToken, config } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/containers/registries`;
    return (await execute<ContainersImageRegistry>('createContainersImageRegistry', 'POST', url, apiToken, config)).result;
}

export type ContainersImageRegistry = {
    public_key?: string,
    domain: string,
    created_at: string,
}

//#endregion

//#region Browser Rendering

export async function getBrowserContent(opts: { accountId: string, apiToken: string, request: BrowserContentRequest }): Promise<string> {
    const { accountId, apiToken, request } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/browser-rendering/content`;
    return (await execute<string>('getBrowserContent', 'POST', url, apiToken, request)).result;
}

export type BrowserContentRequest = {
    /** Set the content of the page, eg: <h1>Hello World!!</h1>. Either html or url must be set. */
    html?: string,

    /** URL to navigate to, eg. https://example.com. Either html or url must be set */
    url?: string,

    /** Adds a <script> tag into the page with the desired URL or content. */
    addScriptTag?: { id?: string, content?: string, type?: string, url?: string }[],

    /** Adds a <link rel="stylesheet"> tag into the page with the desired URL or a <style type="text/css"> tag with the content. */
    addStyleTag?: { content?: string, url?: string }[],

    /** Only allow requests that match the provided regex patterns, eg. '/^.*.(css)'. */
    allowRequestPattern?: string[],

    /** Only allow requests that match the provided resource types, eg. 'image' or 'script'. */
    allowResourceTypes?: ResourceType[],

    /** Provide credentials for HTTP authentication. */
    authenticate?: { username: string, password: string },

    /** Attempt to proceed when 'awaited' events fail or timeout. */
    bestAttempt?: boolean,

    /** Check options (https://pptr.dev/api/puppeteer.page.setcookie). */
    cookies?: {
        name: string,
        value: string,
        domain?: string,
        expires?: number,
        httpOnly?: boolean,
        partitionKey?: string,
        path?: string,
        priority?: 'Low' | 'Medium' | 'High',
        sameParty?: boolean,
        sameSite?: 'Strict' | 'Lax' | 'None',
        secure?: boolean,
        sourcePort?: number,
        sourceScheme?: 'Unset' | 'NonSecure' | 'Secure',
        url?: string,
    }[],

    /** Changes the CSS media type of the page (screen or print) */
    emulateMediaType?: string,

    /** Check options (https://pptr.dev/api/puppeteer.gotooptions). */
    gotoOptions?: {
        referer?: string,
        referrerPolicy?: string,
        timeout?: number,
        waitUntil?: WaitUntil | WaitUntil[],
    },

    /** Block undesired requests that match the provided regex patterns, eg. '/^.*.(css)'. */
    rejectRequestPattern?: string[],

    /** Block undesired requests that match the provided resource types, eg. 'image' or 'script'. */
    rejectResourceTypes?: ResourceType[],

    setExtraHTTPHeaders?: Record<string, string>,

    setJavaScriptEnabled?: boolean,

    userAgent?: string,

    /** Check options (https://pptr.dev/api/puppeteer.page.setviewport). */
    viewport?: {
        height: number,
        width: number,
        deviceScaleFactor?: number,
        hasTouch?: boolean,
        isLandscape?: boolean,
        isMobile?: boolean,
    },

    /** Wait for the selector to appear in page. Check options (https://pptr.dev/api/puppeteer.page.waitforselector). */
    waitForSelector?: {
        selector: string,
        hidden?: boolean,
        timeout?: number,
        visible?: boolean,
    },

    /** Waits for a specified timeout before continuing. */
    waitForTimeout?: number,
}

type ResourceType = 'document' | 'stylesheet' | 'image' | 'media' | 'font' | 'script' | 'texttrack' | 'xhr' | 'fetch' | 'prefetch' | 'eventsource' | 'websocket' | 'manifest' | 'signedexchange' | 'ping' | 'cspviolationreport' | 'preflight' | 'other';

type WaitUntil = 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';

export async function getBrowserJson(opts: { accountId: string, apiToken: string, request: BrowserContentRequest }): Promise<Record<string, unknown>> {
    const { accountId, apiToken, request } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/browser-rendering/json`;
    return (await execute<Record<string, unknown>>('getBrowserJson', 'POST', url, apiToken, request)).result;
}

export type BrowserJsonRequest = BrowserContentRequest & {
    prompt?: string,
    response_format?: {
        type: string, // json_object or json_schema
        
        /** Schema for the response format. More information here: https://developers.cloudflare.com/workers-ai/json-mode/ */
        schema?: Record<string, unknown>
    }
}

export async function getBrowserLinks(opts: { accountId: string, apiToken: string, request: BrowserLinksRequest }): Promise<string[]> {
    const { accountId, apiToken, request } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/browser-rendering/links`;
    return (await execute<string[]>('getBrowserLinks', 'POST', url, apiToken, request)).result;
}

export type BrowserLinksRequest = BrowserContentRequest & {
    visibleLinksOnly?: boolean,
}

export async function getBrowserMarkdown(opts: { accountId: string, apiToken: string, request: BrowserContentRequest }): Promise<string> {
    const { accountId, apiToken, request } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/browser-rendering/markdown`;
    return (await execute<string>('getBrowserMarkdown', 'POST', url, apiToken, request)).result;
}

export async function getBrowserPdf(opts: { accountId: string, apiToken: string, request: BrowserContentRequest }): Promise<Uint8Array> {
    const { accountId, apiToken, request } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/browser-rendering/pdf`;
    return await execute('getBrowserPdf', 'POST', url, apiToken, request, 'bytes');
}

export async function getBrowserElements(opts: { accountId: string, apiToken: string, request: BrowserElementsRequest }): Promise<BrowserElementsResponse[]> {
    const { accountId, apiToken, request } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/browser-rendering/scrape`;
    return (await execute<BrowserElementsResponse[]>('getBrowserElements', 'POST', url, apiToken, request)).result;
}

export type BrowserElementsRequest = BrowserContentRequest & {
    elements: { selector: string }[],
}

export type BrowserElementsResponse = {
    selector: string,
    results: {
        attributes: { name: string, value: string }[],
        html: string,
        left: number,
        top: number,
    }[],
}

export async function getBrowserScreenshot(opts: { accountId: string, apiToken: string, request: BrowserScreenshotRequest }): Promise<Uint8Array | string> {
    const { accountId, apiToken, request } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/browser-rendering/screenshot`;
    if (request.screenshotOptions?.encoding === 'base64') {
        return await execute('getBrowserScreenshot', 'POST', url, apiToken, request, 'text');
    } else {
        return await execute('getBrowserScreenshot', 'POST', url, apiToken, request, 'bytes');
    }
}

export type BrowserScreenshotRequest = BrowserContentRequest & {
    /** Check options (https://pptr.dev/api/puppeteer.screenshotoptions). */
    screenshotOptions?: {
        captureBeyondViewport?: boolean,
        clip?: { height: number, width: number, x: number, y: number, scale?: number },
        encoding?: 'binary' | 'base64',
        fromSurface?: boolean,
        fullPage?: boolean,
        omitBackground?: boolean,
        optimizeForSpeed?: boolean,
        quality?: number,
        type?: 'png' | 'jpeg' | 'webp',
    },
    scrollPage?: boolean,
    selector?: string,
}

export async function getBrowserSnapshot(opts: { accountId: string, apiToken: string, request: BrowserSnapshotRequest }): Promise<BrowserSnapshotResponse> {
    const { accountId, apiToken, request } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/browser-rendering/snapshot`;
    return (await execute<BrowserSnapshotResponse>('getBrowserSnapshot', 'POST', url, apiToken, request)).result;
}

export type BrowserSnapshotRequest = BrowserContentRequest & {
    /** Check options (https://pptr.dev/api/puppeteer.screenshotoptions). */
    screenshotOptions?: {
        captureBeyondViewport?: boolean,
        clip?: { height: number, width: number, x: number, y: number, scale?: number },
        encoding?: 'binary' | 'base64',
        fromSurface?: boolean,
        fullPage?: boolean,
        omitBackground?: boolean,
        optimizeForSpeed?: boolean,
        quality?: number,
        type?: 'png' | 'jpeg' | 'webp',
    },
}

export type BrowserSnapshotResponse = {
    /** HTML content */
    content: string,

    /** Base64 encoded image */
    screenshot: string,
}

//#endregion

//#region Workers for Platforms

export async function listDispatchNamespaces(opts: { accountId: string, apiToken: string }): Promise<DispatchNamespace[]> {
    const { accountId, apiToken } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/workers/dispatch/namespaces`);
    return (await execute<DispatchNamespace[]>('listDispatchNamespaces', 'GET', url.toString(), apiToken)).result;
}

export async function createDispatchNamespace(opts: { accountId: string, apiToken: string, name: string }): Promise<DispatchNamespace> {
    const { accountId, apiToken, name } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/dispatch/namespaces`;
    return (await execute<DispatchNamespace>('createDispatchNamespace', 'POST', url, apiToken, { name })).result;
}

export type DispatchNamespace = {
    namespace_id: string, // guid
    namespace_name: string,
    script_count: number, // 0
    created_on: string, // "2025-07-24T20:47:09.617367Z",
    created_by: string, // account id
    modified_on: string, // "2025-07-24T20:47:09.617367Z",
    modified_by: string, // account id
}

export async function getDispatchNamespace(opts: { accountId: string, apiToken: string, name: string }): Promise<DispatchNamespace> {
    const { accountId, apiToken, name } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/dispatch/namespaces/${name}`;
    return (await execute<DispatchNamespace>('getDispatchNamespace', 'GET', url, apiToken)).result;
}

export async function deleteDispatchNamespace(opts: { accountId: string, apiToken: string, name: string }): Promise<void> {
    const { accountId, apiToken, name } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/dispatch/namespaces/${name}`;
    await execute<null>('deleteDispatchNamespace', 'DELETE', url, apiToken, { name });
}

export async function putScriptInDispatchNamespace(opts: PutScriptOpts & { dispatchNamespace: string, tags?: string[] }): Promise<Script> {
    const { accountId, scriptName, apiToken, dispatchNamespace } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/`;
    const formData = computeUploadForm(opts);
    return (await execute<Script>('putScriptInDispatchNamespace', 'PUT', url, apiToken, formData)).result;
}

export async function getScriptTags(opts: { accountId: string, apiToken: string, dispatchNamespace: string, scriptName: string }): Promise<string[]> {
    const { accountId, apiToken, dispatchNamespace, scriptName } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/tags`;
    return (await execute<string[]>('getScriptTags', 'GET', url, apiToken)).result;
}

export async function putScriptTags(opts: { accountId: string, apiToken: string, dispatchNamespace: string, scriptName: string, tags: string[] }): Promise<string[]> {
    const { accountId, scriptName, apiToken, dispatchNamespace, tags } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/tags`;
    return (await execute<string[]>('putScriptTags', 'PUT', url, apiToken, tags)).result;
}

export async function deleteScriptTag(opts: { accountId: string, apiToken: string, dispatchNamespace: string, scriptName: string, tag: string }): Promise<void> {
    const { accountId, scriptName, apiToken, dispatchNamespace, tag } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${scriptName}/tags/${tag}`;
    await execute<null>('deleteScriptTag', 'DELETE', url, apiToken);
}

export async function listScriptsInDispatchNamespace(opts: { accountId: string, apiToken: string, dispatchNamespace: string, tags?: string }): Promise<Script[]> {
    const { accountId, apiToken, dispatchNamespace, tags } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/workers/dispatch/namespaces/${dispatchNamespace}/scripts`);
    if (tags) url.searchParams.set('tags', tags);
    return (await execute<Script[]>('listScriptsInDispatchNamespace', 'GET', url.toString(), apiToken)).result;
}

export async function deleteScriptsInDispatchNamespace(opts: { accountId: string, apiToken: string, dispatchNamespace: string, tags: string }): Promise<unknown> {
    const { accountId, apiToken, dispatchNamespace, tags } = opts;
    const url = new URL(`${computeAccountBaseUrl(accountId)}/workers/dispatch/namespaces/${dispatchNamespace}/scripts`);
    if (tags) url.searchParams.set('tags', tags);
    return (await execute<unknown>('deleteScriptsInDispatchNamespace', 'DELETE', url.toString(), apiToken)).result;
}

//#endregion

//#region Workers static assets

// https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/assets/subresources/upload/methods/create/
// https://developers.cloudflare.com/workers/static-assets/direct-upload/
export async function createAssetsUploadSession(opts: { accountId: string, apiToken: string, scriptName: string, request: AssetsUploadSessionRequest }): Promise<AssetsUploadSessionResult> {
    const { accountId, apiToken, scriptName, request } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/scripts/${scriptName}/assets-upload-session`;
    return (await execute<AssetsUploadSessionResult>('createAssetsUploadSession', 'POST', url, apiToken, request)).result;
}

export type AssetsUploadSessionRequest = {
    manifest: Record<string, { hash: string, size: number }>,
}

export type AssetsUploadSessionResult = {
    jwt?: string,
    buckets?: string[][],
}

// https://developers.cloudflare.com/api/resources/workers/subresources/assets/subresources/upload/methods/create/
export async function uploadAssets(opts: { accountId: string, apiToken: string, scriptName: string, request: UploadAssetsRequest }): Promise<UploadAssetsResult> {
    const { accountId, apiToken, request } = opts;
    const url = `${computeAccountBaseUrl(accountId)}/workers/assets/upload?base64=true`;

    const form = new FormData();
    for (const [ hash, { base64, contentType } ] of Object.entries(request)) {
        form.append(hash, new Blob([ base64 ], { type: contentType ?? 'application/null' }), hash);
    }
    return (await execute<UploadAssetsResult>('uploadAssets', 'POST', url, apiToken, form)).result;
}

export type UploadAssetsRequest = Record<string, { base64: string, contentType?: string }>; // key = hash

export type UploadAssetsResult = {
    jwt?: string,
    buckets?: string[][],
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
const APPLICATION_PDF = 'application/pdf';
const IMAGE_PNG = 'image/png';
const IMAGE_JPEG = 'image/jpeg';
const IMAGE_WEBP = 'image/webp';
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

type ExecuteBody = string | Record<string, unknown> | Record<string, unknown>[] | string[] | FormData | Uint8Array;

async function execute<Result>(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', url: string, apiToken: string, body?: ExecuteBody, responseType?: 'json', requestContentType?: string, opts?: { nonStandardResponse?: boolean }): Promise<CloudflareApiResponse<Result>>;
async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', url: string, apiToken: string, body?: ExecuteBody, responseType?: 'form'): Promise<FormData>;
async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', url: string, apiToken: string, body?: ExecuteBody, responseType?: 'bytes', requestContentType?: string): Promise<Uint8Array>;
async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', url: string, apiToken: string, body?: ExecuteBody, responseType?: 'sse', requestContentType?: string): Promise<ReadableStream<Uint8Array>>;
async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', url: string, apiToken: string, body?: ExecuteBody, responseType?: 'bytes?'): Promise<Uint8Array | undefined>;
async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', url: string, apiToken: string, body?: ExecuteBody, responseType?: 'text'): Promise<string>;
async function execute<Result>(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', url: string, apiToken: string, body?: ExecuteBody, responseType?: 'json?'): Promise<CloudflareApiResponse<Result> | undefined>;
async function execute(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', url: string, apiToken: string, body?: ExecuteBody, responseType?: 'empty'): Promise<undefined>;
async function execute<Result>(op: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', url: string, apiToken: string, body?: ExecuteBody, responseType: 'json' | 'json?' | 'bytes' | 'bytes?' | 'sse' | 'text' | 'empty' | 'form' = 'json', requestContentType?: string, { nonStandardResponse }: { nonStandardResponse?: boolean } = {}): Promise<CloudflareApiResponse<Result> | Uint8Array | string | undefined | FormData | ReadableStream<Uint8Array>> {
    if (CloudflareApi.DEBUG) console.log(`${op}: ${method} ${url}`);
    const headers = new Headers({ 'Authorization': `Bearer ${apiToken}`});
    let bodyObj: Record<string, unknown> | Record<string, unknown>[] | string[] | undefined;
    if (typeof body === 'string') {
        headers.set('Content-Type', TEXT_PLAIN_UTF8);
    } else if (body instanceof Uint8Array) {
        headers.set('Content-Type', APPLICATION_OCTET_STREAM);
        bodyObj = { bytes: body.length };
    } else if (isStringRecord(body) || Array.isArray(body)) {
        headers.set('Content-Type', requestContentType ?? APPLICATION_JSON_UTF8);
        bodyObj = body;
        body = JSON.stringify(body, undefined, 2);
    }
    if (CloudflareApi.DEBUG) console.log([...headers].map(v => v.join(': ')).join('\n'));
    if (CloudflareApi.DEBUG && bodyObj) console.log(bodyObj);
    const fetchResponse = await fetch(url, { method, headers, body });
    if (CloudflareApi.DEBUG) console.log(`${fetchResponse.status} ${fetchResponse.url}`);
    if (CloudflareApi.DEBUG) console.log([...fetchResponse.headers].map(v => v.join(': ')).join('\n'));
    const contentType = fetchResponse.headers.get('Content-Type') || '';
    const knownBinaryContentType = [ APPLICATION_OCTET_STREAM, IMAGE_PNG, APPLICATION_PDF, IMAGE_JPEG, IMAGE_WEBP ].includes(contentType);
    if (responseType === 'empty' && fetchResponse.status >= 200 && fetchResponse.status < 300) {
        if (contentType !== '') throw new Error(`Unexpected content-type (expected none): ${contentType}, fetchResponse=${fetchResponse}, body=${await fetchResponse.text()}`);
        const text = await fetchResponse.text();
        if (text !== '') throw new Error(`Unexpected body (expected none): ${text}, fetchResponse=${fetchResponse}, body=${text}`);
        return;
    }
    if ((responseType === 'bytes' || responseType === 'bytes?') && knownBinaryContentType) {
        const buffer = await fetchResponse.arrayBuffer();
        return new Uint8Array(buffer);
    }
    if (responseType === 'text') {
        return await fetchResponse.text();
    }
    if (responseType === 'form') {
        // response content type: multipart/form-data; boundary=12f64b0540f60cfc995cf4c5666ef5c4ae71b3927e4c2df3c0689552fad2
        // --12f64b0540f60cfc995cf4c5666ef5c4ae71b3927e4c2df3c0689552fad2
        // Content-Disposition: form-data; name="main"
        return await fetchResponse.formData();
    }
    if (responseType === 'sse') {
        if (contentType !== 'text/event-stream') throw new Error(`Unexpected content-type (expected text/event-stream): ${contentType}, fetchResponse=${fetchResponse}, body=${await fetchResponse.text()}`);
        if (!fetchResponse.body) throw new Error(`No sse body!`);
        return fetchResponse.body;
    }
    if (![APPLICATION_JSON_UTF8.replaceAll(' ', ''), APPLICATION_JSON].includes(contentType.toLowerCase().replaceAll(' ', ''))) { // radar returns: application/json;charset=UTF-8
        throw new Error(`Unexpected content-type: ${contentType}, fetchResponse=${fetchResponse}, body=${knownBinaryContentType ? `<${(await fetchResponse.arrayBuffer()).byteLength} bytes>` : await fetchResponse.text()}`);
    }
    const response = await fetchResponse.json();
    if (nonStandardResponse) {
        if (fetchResponse.ok) {
            const synthetic: CloudflareApiResponse<Result> = {
                success: true,
                result: response,
                errors: [],
            }
            return synthetic;
        }
        throw new CloudflareApiError(`${op} failed: status=${fetchResponse.status}, body=${JSON.stringify(response)}`, fetchResponse.status, []);
    }
    const apiResponse = response as CloudflareApiResponse<Result>;
    if (CloudflareApi.DEBUG) console.log(apiResponse);
    if (!apiResponse.success) {
        if (fetchResponse.status === 404 && [ 'bytes?', 'json?' ].includes(responseType)) return undefined;
        if ('error' in apiResponse && typeof apiResponse.error === 'string') throw new CloudflareApiError(`${op} failed: status=${fetchResponse.status}, error=${apiResponse.error}`, fetchResponse.status, [ { code: fetchResponse.status, message: apiResponse.error } ]);
        throw new CloudflareApiError(`${op} failed: status=${fetchResponse.status}, errors=${apiResponse.errors.map(v => `${v.code} ${v.message}${v.detail ? ` ${v.detail}` : ''}`).join(', ')}`, fetchResponse.status, apiResponse.errors);
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
    readonly detail?: string;
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
