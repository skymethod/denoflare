import { TextLineStream } from 'https://deno.land/std@0.201.0/streams/text_line_stream.ts';

export const DEFAULT_ENDPOINT = `https://dash.deno.com/api`;

export async function listProjects(opts: { apiToken: string, endpoint?: string }): Promise<readonly Project[]> {
    return await executeJson<readonly Project[]>(`/projects`, opts);
}

export async function getProject(opts: { projectId: string, apiToken: string, endpoint?: string }): Promise<Project> {
    const { projectId } = opts;
    return await executeJson<Project>(`/projects/${projectId}`, opts);
}

export async function listDeployments(opts: { projectId: string, limit?: number, page?: number, apiToken: string, endpoint?: string }): Promise<readonly [readonly Deployment[], PagingInfo]> {
    const { projectId, limit, page } = opts;
    return await executeJson<readonly [readonly Deployment[], PagingInfo]>(`/projects/${projectId}/deployments`, { ...opts, queryParams: { limit, page } });
}

export async function negotiateAssets(opts: { projectId: string, manifest: Manifest, apiToken: string, endpoint?: string }): Promise<readonly string[]> {
    const { projectId, manifest } = opts;
    return await executeJson<readonly string[]>(`/projects/${projectId}/assets/negotiate`, { ...opts, requestBody: manifest });
}

export function deploy(opts: { projectId: string, request: DeployRequest, files: Uint8Array[], apiToken: string, endpoint?: string }): AsyncIterable<DeployMessage> {
    const { projectId, request, files } = opts;
    const form = new FormData();
    form.append('request', JSON.stringify(request));
    files.forEach(v => form.append('file', new Blob([v])));
    return executeStream<DeployMessage>(`/projects/${projectId}/deployment_with_assets`, { ...opts, requestBody: form });
}

export async function setEnvironmentVariables(opts: { projectId: string, variables: Record<string, string | null>, apiToken: string, endpoint?: string }): Promise<SetEnvironmentVariablesResult> {
    const { projectId, variables } = opts;
    return await executeJson<SetEnvironmentVariablesResult>(`/projects/${projectId}/env`, { ...opts, method: 'PATCH', requestBody: variables  });
}

//

async function executeJson<T>(pathname: string, opts: ApiCall): Promise<T> {
    const res = await execute(pathname, opts);
    const contentType = res.headers.get('content-type');
    if (res.status !== 200 || contentType !== 'application/json') throw new Error(`Unexpected response: ${res.status} ${contentType} ${await res.text()}`);
    return await res.json();
}

async function* executeStream<T>(pathname: string, opts: ApiCall): AsyncIterable<T> {
    const res = await execute(pathname, opts);
    if (res.status !== 200 || !res.body) throw new Error(`Unexpected response: ${res.status} ${!res.body ? '(no body)' : await res.text()}`);
    const lines = res.body.pipeThrough(new TextDecoderStream()).pipeThrough(new TextLineStream());
    for await (const line of lines) {
        if (line === '') return;
        yield JSON.parse(line);
    }
}

type ApiCall = { queryParams?: Record<string, string | number | undefined>, requestBody?: unknown, method?: 'PATCH' | 'POST', apiToken: string, endpoint?: string };

async function execute(pathname: string, call: ApiCall): Promise<Response> {
    const { queryParams = {}, requestBody, method = requestBody ? 'POST' : 'GET', apiToken, endpoint = DEFAULT_ENDPOINT } = call;
    const url = new URL(`${endpoint}${pathname}`);
    Object.entries(queryParams).forEach(([ n, v ]) => {
        if (v !== undefined) url.searchParams.set(n, String(v));
    });
    const body = requestBody instanceof FormData ? requestBody : requestBody ? JSON.stringify(requestBody) : undefined;
    return await fetch(url.toString(), { method, body, headers: { 
        accept: 'application/json', 
        authorization: `Bearer ${apiToken}`,
        ...(requestBody && !(requestBody instanceof FormData) ? { 'content-type': 'application/json' } : {}),
    } });
}

//

export interface Project {
    readonly id: string; // v4 guid
    readonly name: string;
    readonly type: string; // e.g. playground, git
    readonly git: null;
    readonly playground: Playground;
    readonly productionDeployment: Deployment;
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

export interface Deployment {
    readonly id: string; // e.g. 8bmfqtny52tg
    readonly url: string; // e.g. file:///src/main.ts, file:///src/deploy.ts
    readonly domainMappings: readonly DomainMapping[];
    readonly relatedCommit: null,
    readonly projectId: string; // Project.id, v4 guid
    readonly createdAt: string;  // e.g. 2022-06-28T13:34:36.117979Z
    readonly updatedAt: string;  // e.g. 2022-06-28T13:34:36.117979Z
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
    // deno-lint-ignore ban-types
    readonly features: {};
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

export interface DirectoryManifestEntry{
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
