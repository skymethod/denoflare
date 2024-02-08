import { TextLineStream } from 'https://deno.land/std@0.215.0/streams/text_line_stream.ts';

export type ApiCall = { queryParams?: Record<string, string | number | undefined>, requestBody?: unknown, method?: 'PATCH' | 'POST', accept?: string, apiToken: string, endpoint?: string };

export async function executeJsonForEndpoint<T>(pathname: string, opts: ApiCall, defaultEndpoint: string): Promise<T> {
    const res = await executeForEndpoint(pathname, opts, defaultEndpoint);
    const contentType = res.headers.get('content-type');
    if (res.status !== 200 || contentType !== 'application/json') throw new Error(`Unexpected response: ${res.status} ${contentType} ${await res.text()}`);
    return await res.json();
}

export async function* executeStreamForEndpoint<T>(pathname: string, opts: ApiCall, defaultEndpoint: string): AsyncIterable<T> {
    const res = await executeForEndpoint(pathname, opts, defaultEndpoint);
    if (res.status !== 200 || !res.body) throw new Error(`Unexpected response: ${res.status} ${!res.body ? '(no body)' : await res.text()}`);
    const lines = res.body.pipeThrough(new TextDecoderStream()).pipeThrough(new TextLineStream());
    for await (const line of lines) {
        if (line === '') return;
        yield JSON.parse(line);
    }
}

export async function executeForEndpoint(pathname: string, call: ApiCall, defaultEndpoint: string): Promise<Response> {
    const { queryParams = {}, requestBody, method = requestBody ? 'POST' : 'GET', accept, apiToken, endpoint = defaultEndpoint } = call;
    const url = new URL(`${endpoint}${pathname}`);
    Object.entries(queryParams).forEach(([ n, v ]) => {
        if (v !== undefined) url.searchParams.set(n, String(v));
    });
    const body = requestBody instanceof FormData ? requestBody : requestBody ? JSON.stringify(requestBody) : undefined;
    const response = await fetch(url.toString(), { method, body, headers: { 
        accept: 'application/json', 
        authorization: `Bearer ${apiToken}`,
        ...(requestBody && !(requestBody instanceof FormData) ? { 'content-type': 'application/json' } : {}),
        ...(accept ? { accept } : {}),
    } });
    return response;
}
