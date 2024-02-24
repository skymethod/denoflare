import { ApiCall, executeStreamForEndpoint, executeJsonForEndpoint } from './deno_deploy_common_api.ts';

export const DASH_API_ENDPOINT = `https://dash.deno.com/api`;

export async function getMeta(opts: { apiToken: string, endpoint?: string }): Promise<Metadata> {
    return await executeJson<Metadata>(`/meta`, opts);
}

export async function listProjects(opts: { apiToken: string, endpoint?: string }): Promise<readonly Project[]> {
    return await executeJson<readonly Project[]>(`/projects`, opts);
}

export async function getProject(opts: { projectId: string, apiToken: string, endpoint?: string }): Promise<Project> {
    const { projectId } = opts;
    return await executeJson<Project>(`/projects/${projectId}`, opts);
}

export async function listDeployments(opts: { projectId: string, limit?: number, page?: number, apiToken: string, endpoint?: string }): Promise<readonly [readonly ProductionDeployment[], PagingInfo | null]> {
    const { projectId, limit, page } = opts;
    return await executeJson<readonly [readonly ProductionDeployment[], PagingInfo]>(`/projects/${projectId}/deployments`, { ...opts, queryParams: { limit, page } });
}

export async function negotiateAssets(opts: { projectId: string, manifest: Manifest, apiToken: string, endpoint?: string }): Promise<readonly string[]> {
    const { projectId, manifest } = opts;
    return await executeJson<readonly string[]>(`/projects/${projectId}/assets/negotiate`, { ...opts, requestBody: manifest });
}

export function deploy(opts: { projectId: string, request: DeployRequest, files: Uint8Array[], apiToken: string, endpoint?: string }): AsyncIterable<DeployMessage> {
    const { projectId, request, files } = opts;
    const form = new FormData();
    form.append('request', JSON.stringify(request));
    files.forEach(v => form.append('file', new Blob([ v ])));
    return executeStreamForEndpoint<DeployMessage>(`/projects/${projectId}/deployment_with_assets`, { ...opts, requestBody: form }, DASH_API_ENDPOINT);
}

export async function setEnvironmentVariables(opts: { projectId: string, variables: Record<string, string | null>, apiToken: string, endpoint?: string }): Promise<SetEnvironmentVariablesResult> {
    const { projectId, variables } = opts;
    return await executeJson<SetEnvironmentVariablesResult>(`/projects/${projectId}/env`, { ...opts, method: 'PATCH', requestBody: variables  });
}

export function getLogs(opts: { projectId: string, deploymentId: string, apiToken: string, endpoint?: string }): AsyncIterable<LiveLog> {
    const { projectId, deploymentId, apiToken, endpoint } = opts;
    return executeStreamForEndpoint<LiveLog>(`/projects/${projectId}/deployments/${deploymentId}/logs/`, { apiToken, endpoint }, DASH_API_ENDPOINT);
}

export async function queryLogs(opts: { projectId: string, deploymentId: string, params: LogQueryRequestParams, apiToken: string, endpoint?: string }): Promise<{ logs: readonly PersistedLog[] }> {
    const { projectId, deploymentId, params, apiToken, endpoint } = opts;
    return await executeJson<{ logs: readonly PersistedLog[] }>(`/projects/${projectId}/deployments/${deploymentId}/query_logs`, { apiToken, endpoint, queryParams: { params: JSON.stringify(params)} });
}

//

async function executeJson<T>(pathname: string, opts: ApiCall): Promise<T> {
    return await executeJsonForEndpoint<T>(pathname, opts, DASH_API_ENDPOINT);
}

//

export interface Project {
    readonly id: string; // v4 guid
    readonly name: string;
    readonly type: string; // e.g. playground, git
    readonly git: null;
    readonly playground: Playground;
    readonly productionDeployment?: ProductionDeployment; // only missing on new projects
    readonly hasProductionDeployment: boolean;
    readonly organizationId: string; // Organization.id, v4 guid
    readonly organization: Organization;
    readonly envVars: readonly string[]; // e.g. 'VARNAME'
    readonly createdAt: string;  // e.g. 2022-06-28T13:34:36.117979Z
    readonly updatedAt: string;  // e.g. 2022-06-28T13:34:36.117979Z
}

export interface Playground {
    readonly snippet: string; // e.g. import { ... }
    readonly mediaType: string; // e.g. ts
    readonly isPublic: boolean;
}

export interface ProductionDeployment {
    readonly id: string; // v4 guid
    readonly relatedCommit: null,
    readonly projectId: string; // Project.id, v4 guid
    readonly createdAt: string;  // e.g. 2022-06-28T13:34:36.117979Z
    readonly updatedAt: string;  // e.g. 2022-06-28T13:34:36.117979Z
    readonly deployment: Deployment | null;
    readonly logs: readonly DeployMessage[];
}

export interface Deployment {
    readonly id: string; // e.g. 8bmfqtny52tg
    readonly url: string; // e.g. file:///src/main.ts, file:///src/deploy.ts, https://deno.com/examples/hello.js
    readonly domainMappings: readonly DomainMapping[];
    readonly envVars: readonly string[]; // e.g. 'VARNAME'
    readonly isBlocked: boolean;
}

export interface DomainMapping {
    readonly domain: string; // e.g. ${projectName}.deno.dev, ${projectName}-${deploymentId}.deno.dev
    readonly createdAt: string;  // e.g. 2022-06-28T13:34:36.117979Z
    readonly updatedAt: string;  // e.g. 2022-06-28T13:34:36.117979Z
}

export interface Organization {
    readonly id: string; // v4 guid
    readonly name: null;
    readonly pro: boolean;
    readonly features: {
        database?: boolean,
    };
    readonly createdAt: string;  // e.g. 2022-06-28T13:34:36.117979Z
    readonly updatedAt: string;  // e.g. 2022-06-28T13:34:36.117979Z
}

export interface PagingInfo {
    readonly page: number; // 0-based
    readonly count: number;
    readonly limit: number;
    readonly totalCount: number;
    readonly totalPages: number | null;
}

export interface Manifest {
    readonly entries: Record<string, ManifestEntry>;
}

export interface FileManifestEntry {
    readonly kind: 'file';
    readonly gitSha1: string;
    readonly size: number;
}

export interface DirectoryManifestEntry {
    readonly kind: 'directory';
    readonly entries: Record<string, ManifestEntry>;
}

export interface SymlinkManifestEntry {
    readonly kind: 'symlink';
    readonly target: string;
}

export type ManifestEntry = FileManifestEntry | DirectoryManifestEntry | SymlinkManifestEntry;

export interface DeployRequest {
    readonly url: string;
    readonly importMapUrl: string | null;
    readonly production: boolean;
    readonly manifest?: Manifest;
}

export type DeployMessage = StaticFileDeployMessage | LoadDeployMessage | UploadCompleteDeployMessage | SuccessDeployMessage | ErrorDeployMessage;

export interface StaticFileDeployMessage {
    // sent only for hashes that are new
    // on start: { currentBytes: 0, totalBytes: n }
    // on end: { currentBytes: n, totalBytes: n }
    readonly type: 'staticFile';
    readonly currentBytes: number;
    readonly totalBytes: number;
}

export interface LoadDeployMessage {
    readonly type: 'load';
    readonly url: string; // file:///src/... or https://...
    readonly seen: number; // increments 1 to n on every load
    readonly total: number;
}

export interface UploadCompleteDeployMessage {
    readonly type: 'uploadComplete';
}

export interface SuccessDeployMessage extends Deployment {
    readonly type: 'success';
}

export interface ErrorDeployMessage {
    readonly type: 'error';
    readonly code: string; // e.g. DeploymentFailed
    readonly ctx: string; // error message
}

export interface SetEnvironmentVariablesResult {
    readonly result: Project;
}

export interface Metadata {
    readonly regionCodes: string[]; // e.g. gcp-us-east1
}

export interface LogQueryRequestParams {
    readonly regions?: string[];
    readonly levels?: string[];
    readonly since?: string;
    readonly until?: string;
    readonly q?: string[];
    readonly limit?: number;
}

export interface LiveLogReady {
    readonly type: 'ready';
}

export interface LiveLogPing {
    readonly type: 'ping';
}

export interface LiveLogMessage {
    readonly type: 'message';
    readonly time: string;
    readonly message: string;
    readonly level: 'debug' | 'info' | 'warning' | 'error';
    readonly region: string;
}

export type LiveLog =
    | LiveLogReady
    | LiveLogPing
    | LiveLogMessage;

export interface PersistedLog {
    readonly deploymentId: string;
    readonly isolateId: string;
    readonly region: string;
    readonly level: 'debug' | 'info' | 'warning' | 'error';
    readonly timestamp: string;
    readonly message: string;
}