import { ApiCall, executeJsonForEndpoint, executeStreamForEndpoint } from './deno_deploy_common_api.ts';

// https://docs.deno.com/deploy/api/rest/

export const REST_API_ENDPOINT = `https://api.deno.com/v1`;

// https://docs.deno.com/deploy/api/rest/organizations#get-organization-details
export async function getOrganizationDetails(opts: { organizationId: string, apiToken: string, endpoint?: string }): Promise<unknown> {
    const { organizationId } = opts;
    return await executeJson<unknown>(`/organizations/${organizationId}`, { ...opts });
}

// https://docs.deno.com/deploy/api/rest/projects#list-projects-for-an-organization
export async function listProjects(opts: { apiToken: string, organizationId: string, endpoint?: string }): Promise<readonly Project[]> {
    const { organizationId } = opts;
    return await executeJson<readonly Project[]>(`/organizations/${organizationId}/projects`, opts);
}

export interface Project {
    readonly id: string; // guid
    readonly name: string;
    readonly description: string;
    readonly createdAt: string; // e.g. 2023-12-10T19:15:07.157937Z
    readonly updatedAt: string; // e.g. 2023-12-10T19:15:07.157937Z
}

// https://docs.deno.com/deploy/api/rest/projects#get-project-details
export async function getProjectDetails(opts: { apiToken: string, projectId: string, endpoint?: string }): Promise<Project> {
    const { projectId } = opts;
    return await executeJson<Project>(`/projects/${projectId}`, opts);
}

// https://docs.deno.com/deploy/api/rest/deployments#list-deployments-for-a-project
export async function listProjectDeployments(opts: { apiToken: string, projectId: string, page?: number, limit?: number, q?: string, sort?: string, order?: 'asc' | 'desc', endpoint?: string }): Promise<readonly Deployment[]> {
    const { projectId, page, limit, q, sort, order } = opts;
    return await executeJson<readonly Deployment[]>(`/projects/${projectId}/deployments`, { ...opts, queryParams: { page, limit, q, sort, order } });
}

export interface Deployment {
    readonly id: string; // e.g. prsgm0rsp4pj
    readonly projectId: string;
    readonly description: string;
    readonly status: string; // e.g. success
    readonly domains: readonly string[]; // e.g. project-name-prsgm0rsp4pj.deno.dev
    readonly databases: { 
        readonly default: string; // guid
    };
    readonly createdAt: string; // e.g. 2023-12-10T19:15:07.157937Z
    readonly updatedAt: string; // e.g. 2023-12-10T19:15:07.157937Z
}

// https://docs.deno.com/deploy/api/rest/deployments#get-deployment-details
export async function getDeploymentDetails(opts: { deploymentId: string, apiToken: string, endpoint?: string }): Promise<Deployment> {
    const { deploymentId } = opts;
    return await executeJson<Deployment>(`/deployments/${deploymentId}`, opts);
}

// https://docs.deno.com/deploy/api/rest/deployments#get-deployment-build-logs
export async function getDeploymentBuildLogs(opts: { deploymentId: string, apiToken: string, endpoint?: string }): Promise<readonly BuildLog[]> {
    const { deploymentId } = opts;
    return await executeJson<readonly BuildLog[]>(`/deployments/${deploymentId}/build_logs`, opts);
}

export interface BuildLog {
    readonly level: string; // e.g. trace, info
    readonly message: string;
}

// https://docs.deno.com/deploy/api/rest/deployments#get-deployment-app-logs
type PastOpts = { since: string, until?: string } | { since?: string, until: string } | { since: string, until: string };
export async function getDeploymentPastAppLogs(opts: PastOpts & { deploymentId: string, apiToken: string, cursor?: string, level?: string, region?: string, page?: number, limit?: number, q?: string, sort?: string, order?: 'asc' | 'desc', endpoint?: string }): Promise<readonly AppLog[]> {
    const { deploymentId, cursor, since, until, level, region, page, limit, q, sort, order } = opts;
    if (since === undefined && until === undefined) throw new Error(`Must provide 'since', 'until', or both`);
    return await executeJson<readonly AppLog[]>(`/deployments/${deploymentId}/app_logs`, { ...opts, queryParams: { cursor, since, until, level, region, page, limit, q, sort, order } });
}

export interface AppLog {
    readonly time: string;
    readonly level: string; // e.g. trace, info
    readonly message: string;
    readonly region: string;
}

export function getDeploymentRealtimeAppLogs(opts: { deploymentId: string, apiToken: string, endpoint?: string }): AsyncIterable<AppLog> {
    const { deploymentId } = opts;
    return executeStreamForEndpoint<AppLog>(`/deployments/${deploymentId}/app_logs`, { ...opts, accept: 'application/x-ndjson', queryParams: {  } }, REST_API_ENDPOINT);
}

// https://docs.deno.com/deploy/api/rest/organizations#get-analytics-for-organization
export async function getOrganizationAnalytics(opts: { organizationId: string, since: string, until: string, apiToken: string, endpoint?: string }): Promise<Analytics> {
    const { organizationId, since, until } = opts;
    return await executeJson<Analytics>(`/organizations/${organizationId}/analytics`, { ...opts, queryParams: { since, until } });
}

// https://docs.deno.com/deploy/api/rest/projects#get-project-analytics
export async function getProjectAnalytics(opts: { projectId: string, since: string, until: string, apiToken: string, endpoint?: string }): Promise<Analytics> {
    const { projectId, since, until } = opts;
    return await executeJson<Analytics>(`/projects/${projectId}/analytics`, { ...opts, queryParams: { since, until } });
}

export interface Analytics {
    readonly fields: readonly { name: string, type: string }[];
    readonly values: readonly [][]; // each row: [ '2023-08-01T00:00:00Z', 123, ... ]
}

// https://docs.deno.com/deploy/api/rest/databases#list-an-organizations-kv-databases
export async function listOrganizationDatabases(opts: { organizationId: string, page?: number, limit?: number, q?: string, sort?: string, order?: 'asc' | 'desc', apiToken: string, endpoint?: string }): Promise<readonly Database[]> {
    const { organizationId, page, limit, q, sort, order } = opts;
    return await executeJson<readonly Database[]>(`/organizations/${organizationId}/databases`, { ...opts, queryParams: { page, limit, q, sort, order } });
}

export interface Database {
    readonly id: string; // guid
    readonly organizationId: string;
    readonly description: string;
    readonly createdAt: string; // e.g. 2023-12-10T19:15:07.157937Z
    readonly updatedAt: string; // e.g. 2023-12-10T19:15:07.157937Z
}

// https://docs.deno.com/deploy/api/rest/domains#list-an-organizations-domains
export async function listOrganizationDomains(opts: { organizationId: string, page?: number, limit?: number, q?: string, sort?: string, order?: 'asc' | 'desc', apiToken: string, endpoint?: string }): Promise<readonly Domain[]> {
    const { organizationId, page, limit, q, sort, order } = opts;
    return await executeJson<readonly Domain[]>(`/organizations/${organizationId}/domains`, { ...opts, queryParams: { page, limit, q, sort, order } });
}

export interface Domain {
    readonly id: string; // guid
    readonly organizationId: string;
    readonly domain: string;
    // TODO others when seen
    readonly createdAt: string; // e.g. 2023-12-10T19:15:07.157937Z
    readonly updatedAt: string; // e.g. 2023-12-10T19:15:07.157937Z
}

//

async function executeJson<T>(pathname: string, opts: ApiCall): Promise<T> {
    return await executeJsonForEndpoint<T>(pathname, opts, REST_API_ENDPOINT);
}
