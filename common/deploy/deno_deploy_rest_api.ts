import { ApiCall, executeJsonForEndpoint } from './deno_deploy_common_api.ts';

export const REST_API_ENDPOINT = `https://api.deno.com/v1`;

// // https://docs.deno.com/deploy/api/rest/projects#list-projects-for-an-organization
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

// https://docs.deno.com/deploy/api/rest/projects#get-project-analytics
export async function getProjectAnalytics(opts: { projectId: string, since: string, until: string, apiToken: string, endpoint?: string }): Promise<ProjectAnalytics> {
    const { projectId, since, until } = opts;
    return await executeJson<ProjectAnalytics>(`/projects/${projectId}/analytics`, { ...opts, queryParams: { since, until } });
}

export interface ProjectAnalytics {
    readonly fields: readonly { name: string, type: string }[];
    readonly values: readonly [][]; // each row: [ '2023-08-01T00:00:00Z', 123, ... ]
}

//

async function executeJson<T>(pathname: string, opts: ApiCall): Promise<T> {
    return await executeJsonForEndpoint<T>(pathname, opts, REST_API_ENDPOINT);
}
