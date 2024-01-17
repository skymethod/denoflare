
// List all secrets
// https://supabase.com/docs/reference/api/list-all-secrets

export async function listSecrets({ projectRef, token, fetcher }: { projectRef: string, token: string, fetcher?: Fetcher }): Promise<ApiResponse<readonly SecretInfo[]>> {
    return await execute(`/v1/projects/${projectRef}/secrets`, { token, fetcher }, async res => checkArrayOf(await res.json(), checkSecretInfo));
}

export type SecretInfo = { 
    readonly name: string, 
    readonly value: string,
};

function isSecretInfo(obj: unknown): obj is SecretInfo {
    return isStringRecord(obj)
        && typeof obj.name === 'string'
        && typeof obj.value === 'string'
        ;
}

function checkSecretInfo(obj: unknown): SecretInfo {
    if (!isSecretInfo(obj)) throw new Error(JSON.stringify(obj));
    // deno-lint-ignore no-unused-vars
    const { name, value, ...rest } = obj;
    if (Object.keys(rest).length > 0) throw new Error(JSON.stringify(obj));
    return obj;
}

// Bulk create secrets
// https://supabase.com/docs/reference/api/bulk-create-secrets

export async function bulkCreateSecrets({ projectRef, secrets, token, fetcher }: { projectRef: string, secrets: SecretInfo[], token: string, fetcher?: Fetcher }): Promise<ApiResponse<undefined>> {
    return await execute(`/v1/projects/${projectRef}/secrets`, { method: 'POST', body: JSON.stringify(secrets), bodyContentType: 'application/json', token, fetcher }, _ => undefined);
}

// Bulk delete secrets
// https://supabase.com/docs/reference/api/bulk-delete-secrets

export async function bulkDeleteSecrets({ projectRef, names, token, fetcher }: { projectRef: string, names: string[], token: string, fetcher?: Fetcher }): Promise<ApiResponse<undefined>> {
    return await execute(`/v1/projects/${projectRef}/secrets`, { method: 'DELETE', body: JSON.stringify(names), bodyContentType: 'application/json', token, fetcher }, _ => undefined);
}

// List all functions
// https://supabase.com/docs/reference/api/list-all-functions

export async function listFunctions({ projectRef, token, fetcher }: { projectRef: string, token: string, fetcher?: Fetcher }): Promise<ApiResponse<readonly FunctionInfo[]>> {
    return await execute(`/v1/projects/${projectRef}/functions`, { token, fetcher }, async res => checkArrayOf(await res.json(), checkFunctionInfo));
}

export type FunctionInfo = { 
    readonly verify_jwt: boolean, 
    readonly id: string, // e.g. dfb28f2a-a1ae-4367-bfac-d6a333b7b13d
    readonly slug: string, // e.g. hello-1
    readonly name: string, // e.g. hello 1
    readonly version: number, // e.g. 1
    readonly status: string, // e.g. ACTIVE
    readonly created_at: number, // e.g. 1705256686007
    readonly updated_at: number, // e.g. 1705256686007
    readonly import_map: boolean,
    readonly entrypoint_path: string, // e.g. file:///src/index.ts
};

function isFunctionInfo(obj: unknown): obj is FunctionInfo {
    return isStringRecord(obj)
        && typeof obj.verify_jwt === 'boolean'
        && typeof obj.id === 'string'
        && typeof obj.slug === 'string'
        && typeof obj.name === 'string'
        && typeof obj.version === 'number'
        && typeof obj.status === 'string'
        && typeof obj.created_at === 'number'
        && typeof obj.updated_at === 'number'
        && typeof obj.import_map === 'boolean'
        && typeof obj.entrypoint_path === 'string'
        ;
}

function checkFunctionInfo(obj: unknown): FunctionInfo {
    if (!isFunctionInfo(obj)) throw new Error(JSON.stringify(obj));
    // deno-lint-ignore no-unused-vars
    const { verify_jwt, id, slug, name, version, status, created_at, updated_at, import_map, entrypoint_path, ...rest } = obj;
    if (Object.keys(rest).length > 0) throw new Error(JSON.stringify(obj));
    return obj;
}

// Get a function
// https://supabase.com/docs/reference/api/retrieve-a-function

export async function getFunction({ projectRef, slug, token, fetcher }: { projectRef: string, slug: string, token: string, fetcher?: Fetcher }): Promise<ApiResponse<FunctionInfo>> {
    return await execute(`/v1/projects/${projectRef}/functions/${slug}`, { token, fetcher }, async res => checkFunctionInfo(await res.json()));
}

// Get a function body
// https://supabase.com/docs/reference/api/retrieve-a-function-body

export async function getFunctionBody({ projectRef, slug, token, fetcher }: { projectRef: string, slug: string, token: string, fetcher?: Fetcher }): Promise<ApiResponse<Uint8Array>> {
    return await execute(`/v1/projects/${projectRef}/functions/${slug}/body`, { token, fetcher }, async res => new Uint8Array(await res.arrayBuffer()));
}

// Delete a function
// https://supabase.com/docs/reference/api/delete-a-function

export async function deleteFunction({ projectRef, slug, token, fetcher }: { projectRef: string, slug: string, token: string, fetcher?: Fetcher }): Promise<ApiResponse<boolean>> {
    return await execute(`/v1/projects/${projectRef}/functions/${slug}`, { token, fetcher, method: 'DELETE' }, res => res.status === 200);
}

// Create a function
// https://supabase.com/docs/reference/api/create-a-function

// edge function limitations: https://supabase.com/docs/guides/functions/debugging#limitations

export type CreateFunctionOpts = { projectRef: string, slug: string, name: string, verify_jwt?: boolean, import_map?: boolean, entrypoint_path?: string, import_map_path?: string, brotliCompressedEszip: Uint8Array, token: string, fetcher?: Fetcher };

export async function createFunction({ projectRef, slug, name, verify_jwt, import_map, entrypoint_path, import_map_path, brotliCompressedEszip, token, fetcher }: CreateFunctionOpts): Promise<ApiResponse<FunctionInfo>> {
    return await execute(`/v1/projects/${projectRef}/functions`, { token, fetcher, method: 'POST', body: brotliCompressedEszip, bodyContentType: 'application/vnd.denoland.eszip', queryParams: { slug, name, verify_jwt, import_map, entrypoint_path, import_map_path } }, 
        async res => checkFunctionInfo(await res.json()));
}

// Update a function
// https://supabase.com/docs/reference/api/update-a-function

export type UpdateFunctionOpts = { projectRef: string, slug: string, newSlug?: string, name?: string, verify_jwt?: boolean, import_map?: boolean, entrypoint_path?: string, import_map_path?: string, brotliCompressedEszip: Uint8Array, token: string, fetcher?: Fetcher };

export async function updateFunction({ projectRef, slug, newSlug, name, verify_jwt, import_map, entrypoint_path, import_map_path,brotliCompressedEszip, token, fetcher }: UpdateFunctionOpts): Promise<ApiResponse<FunctionInfo>> {
    return await execute(`/v1/projects/${projectRef}/functions/${slug}`, { token, fetcher, method: 'PATCH', body: brotliCompressedEszip, bodyContentType: 'application/vnd.denoland.eszip', queryParams: { slug: newSlug, name, verify_jwt, import_map, entrypoint_path, import_map_path } }, 
        async res => checkFunctionInfo(await res.json()));
}

// Execute a function

// https://supabase.com/docs/guides/functions/regional-invocation#available-regions
export type Region = 'ap-northeast-1' | 'ap-northeast-2' | 'ap-south-1' | 'ap-southeast-1' | 'ap-southeast-2' | 'ca-central-1' | 'eu-central-1' | 'eu-west-1' | 'eu-west-2' | 'eu-west-3' | 'sa-east-1' | 'us-east-1' | 'us-west-1' | 'us-west-2';

export type ExecuteFunctionOpts = { projectRef: string, slug: string, method?: string, pathname?: string, queryParams?: Record<string, string>, headers?: Record<string, string>, body?: Uint8Array | string, region?: Region, fetcher?: Fetcher };

export async function executeFunction({ projectRef, slug, pathname = '/', method, queryParams, headers, body, region, fetcher = fetch }: ExecuteFunctionOpts): Promise<Response> {
    return await fetcher(makeURL(`https://${projectRef}.supabase.co/functions/v1/${slug}${pathname}`, queryParams).toString(), { method, headers: { ...headers,  ...(region ? { 'x-region': region } : {}) }, body });
}

//

export type ApiResponse<TResult> = {  meta: Record<string, string>, result: TResult };

export type Fetcher = (url: string, opts: { method?: string, headers?: Record<string, string>, body?: Uint8Array | string }) => Promise<Response>;

//

// deno-lint-ignore no-explicit-any
function isStringRecord(obj: any): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && obj.constructor === Object;
}

function checkArrayOf<T>(obj: unknown, checkFn: (obj: unknown) => T): readonly T[] {
    if (!Array.isArray(obj)) throw new Error(JSON.stringify(obj));
    return obj.map(checkFn);
}

type ExecuteOpts = { token: string, method?: 'GET' | 'DELETE' | 'POST' | 'PATCH', queryParams?: Record<string, string | boolean | undefined>, body?: Uint8Array | string, bodyContentType?: string, fetcher?: Fetcher };

async function execute<TResult>(pathname: string, { token, method = 'GET', queryParams, body, bodyContentType, fetcher = fetch }: ExecuteOpts, resultFn: (res: Response) => Promise<TResult> | TResult): Promise<ApiResponse<TResult>> {
    const res = await fetcher(makeURL(`https://api.supabase.com${pathname}`, queryParams).toString(), { method, headers: { authorization: `Bearer ${token}`, ...(bodyContentType ? { 'content-type': bodyContentType } : {}) }, body });
    const expected = method === 'POST' ? 201 : 200;
    if (res.status !== expected && !(method === 'DELETE' && res.status === 404)) throw new Error(`Expected ${expected}, found ${res.status} ${await res.text()}`);
    const meta = Object.fromEntries(res.headers);
    const result = await resultFn(res);
    return { meta, result };
}

function makeURL(url: string, queryParams?: Record<string, string | boolean | undefined>): URL {
    const rt = new URL(url);
    for (const [ name, value ] of Object.entries(queryParams ?? {})) {
        if (value !== undefined) rt.searchParams.set(name, value.toString());
    }
    return rt;
}
