
export type ApiCall = { queryParams?: Record<string, string | number | undefined>, requestBody?: unknown, method?: 'PATCH' | 'POST', apiToken: string, endpoint?: string };

export async function executeJsonForEndpoint<T>(pathname: string, opts: ApiCall, defaultEndpoint: string): Promise<T> {
    const res = await executeForEndpoint(pathname, opts, defaultEndpoint);
    const contentType = res.headers.get('content-type');
    if (res.status !== 200 || contentType !== 'application/json') throw new Error(`Unexpected response: ${res.status} ${contentType} ${await res.text()}`);
    return await res.json();
}

export async function executeForEndpoint(pathname: string, call: ApiCall, defaultEndpoint: string): Promise<Response> {
    const { queryParams = {}, requestBody, method = requestBody ? 'POST' : 'GET', apiToken, endpoint = defaultEndpoint } = call;
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
