export const DEFAULT_ENDPOINT = `https://dash.deno.com/api`;

export async function listProjects(opts: { apiToken: string, endpoint?: string }): Promise<readonly Project[]> {
    return await getJson<readonly Project[]>(`/projects`, opts);
}

export async function getProject(opts: { projectId: string, apiToken: string, endpoint?: string }): Promise<Project> {
    const { projectId } = opts;
    return await getJson<Project>(`/projects/${projectId}`, opts);
}

export async function listDeployments(opts: { projectId: string, limit?: number, page?: number, apiToken: string, endpoint?: string }): Promise<readonly [readonly Deployment[], PagingInfo]> {
    const { projectId, limit, page } = opts;
    return await getJson<readonly [readonly Deployment[], PagingInfo]>(`/projects/${projectId}/deployments`, { ...opts, queryParams: { limit, page } });
}

//

async function getJson<T>(pathname: string, opts: { queryParams?: Record<string, string | number | undefined>, apiToken: string, endpoint?: string }): Promise<T> {
    const { queryParams = {}, apiToken, endpoint = DEFAULT_ENDPOINT } = opts;
    const url = new URL(`${endpoint}${pathname}`);
    Object.entries(queryParams).forEach(([ n, v ]) => {
        if (v !== undefined) url.searchParams.set(n, String(v));
    });
    const res = await fetch(url.toString(), { headers: { accept: 'application/json', authorization: `Bearer ${apiToken}` } });
    const contentType = res.headers.get('content-type');
    if (res.status !== 200 || contentType !== 'application/json') throw new Error(`Unexpected response: ${res.status} ${contentType} ${await res.text()}`);
    return await res.json();
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
    readonly totalPages: number;
}

//

if (import.meta.main) {
    const [ projectId, apiToken ] = Deno.args;
    console.log(JSON.stringify(await listDeployments({ projectId, apiToken, limit: 2 }), undefined, 2));
    // console.log(await getProject({ projectId, apiToken }));
}
