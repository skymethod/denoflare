import { CloudflareWebSocketExtensions } from './cloudflare_workers_types.d.ts';
import { consoleLog } from './console.ts';
import { Constants } from './constants.ts';
import { DenoflareResponse } from './denoflare_response.ts';
import { RpcChannel } from './rpc_channel.ts';

// ReadableStreamReadResult removed in deno 1.28.3
// https://github.com/denoland/deno/pull/16191
type ReadableStreamReadResult<V extends ArrayBufferView> = ReadableStreamBYOBReadResult<V>

export function makeFetchOverRpc(channel: RpcChannel, bodies: Bodies, webSocketResolver: WebSocketResolver): (info: RequestInfo, init?: RequestInit) => Promise<Response | DenoflareResponse> {
    return async (info: RequestInfo, init?: RequestInit) => {
        const data = packRequest(info, init, bodies);
        return await channel.sendRequest('fetch', data, responseData => unpackResponse(responseData, makeBodyResolverOverRpc(channel), webSocketResolver));
    }
}

export function makeBodyResolverOverRpc(channel: RpcChannel): BodyResolver {
    return bodyId => new ReadableStream({
        start(_controller)  {
            // consoleLog(`RpcBodyResolver(${bodyId}): start controller.desiredSize=${controller.desiredSize}`);
        },
        async pull(controller): Promise<void> {
            // consoleLog(`RpcBodyResolver(${bodyId}): pull controller.desiredSize=${controller.desiredSize}`);
            const { value, done } = await channel.sendRequest('read-body-chunk', { bodyId }, responseData => {
                return responseData as ReadableStreamReadResult<Uint8Array>;
            });
            // event loop workaround needed as of Deno 1.34.2
            setTimeout(() => {
                if (value !== undefined) controller.enqueue(value);
                if (done) try { controller.close(); } catch (e) { console.warn(`Ignoring error closing rpc body stream: ${e.stack}`); }
            }, 0);
        },
        cancel(reason) {
            consoleLog(`RpcBodyResolver(${bodyId}): cancel reason=${reason}`);
        },
    });
}

export function addRequestHandlerForReadBodyChunk(channel: RpcChannel, bodies: Bodies) {
    channel.addRequestHandler('read-body-chunk', async requestData => {
        const { bodyId } = requestData;
        const { value, done } = await bodies.readBodyChunk(bodyId);
        return { data: { value, done }, transfer: value ? [ value.buffer ] : [] };
    });
}

export type BodyResolver = (bodyId: number) => ReadableStream<Uint8Array>;
export type WebSocketResolver = (webSocketId: string) => WebSocket & CloudflareWebSocketExtensions;
export type WebSocketPacker = (webSocket: WebSocket & CloudflareWebSocketExtensions) => string;

export async function packResponse(response: Response, bodies: Bodies, webSocketPacker: WebSocketPacker, overrideContentType?: string): Promise<PackedResponse> {
    const { status, url, redirected } = response;
    const headers = [...response.headers.entries()];
    if (overrideContentType) {
        const i = headers.findIndex(v => v[0].toLowerCase() === 'content-type');
        if (i > -1) {
            headers.splice(i, 1);
        }
        headers.push(['content-type', overrideContentType]);
    }
    if (DenoflareResponse.is(response)) {
        const webSocketId = response.init?.webSocket ? webSocketPacker(response.init?.webSocket) : undefined;
        if (typeof response.bodyInit === 'string') {
            const bodyText = response.bodyInit;
            return { status, headers, bodyId: undefined, bodyText, bodyBytes: undefined, bodyNull: false, webSocketId, url, redirected };
        } else if (response.bodyInit instanceof Uint8Array) {
            const bodyBytes = response.bodyInit;
            return { status, headers, bodyId: undefined, bodyText: undefined, bodyBytes, bodyNull: false, webSocketId, url, redirected };
        } else if (response.bodyInit instanceof ReadableStream) {
            const bodyId = bodies.computeBodyId(response.bodyInit);
            return { status, headers, bodyId, bodyText: undefined, bodyBytes: undefined, bodyNull: false, webSocketId, url, redirected };
        } else if (response.bodyInit instanceof ArrayBuffer) {
            const bodyBytes = new Uint8Array(new Uint8Array(response.bodyInit)); // fast way to copy an arraybuffer
            return { status, headers, bodyId: undefined, bodyText: undefined, bodyBytes, bodyNull: false, webSocketId, url, redirected };
        } else if (response.bodyInit === null || response.bodyInit === undefined) {
            return { status, headers, bodyId: undefined, bodyText: undefined, bodyBytes: undefined, bodyNull: true, webSocketId, url, redirected };
        } else {
            throw new Error(`packResponse: DenoflareResponse bodyInit=${response.bodyInit}`);
        }
    }
    const webSocketId = undefined;
    const contentLength = parseInt(response.headers.get('content-length') || '-1');
    if (contentLength > -1 && contentLength <= Constants.MAX_CONTENT_LENGTH_TO_PACK_OVER_RPC) {
        const bodyBytes = new Uint8Array(await response.arrayBuffer());
        // consoleLog(`packResponse: contentLength=${contentLength} bodyBytes.byteLength=${bodyBytes.byteLength} url=${response.url}`);
        return { status, headers, bodyId: undefined, bodyText: undefined, bodyBytes, bodyNull: false, webSocketId, url, redirected };
    }
    const bodyId = bodies.computeBodyId(response.body);
    return { status, headers, bodyId, bodyText: undefined, bodyBytes: undefined, bodyNull: false, webSocketId, url, redirected };
}

const _Response = Response;

export function unpackResponse(packed: PackedResponse, bodyResolver: BodyResolver, webSocketResolver: WebSocketResolver): Response | DenoflareResponse {
    const { status, bodyId, bodyText, bodyBytes, bodyNull, webSocketId, url, redirected } = packed;
    const headers = new Headers(packed.headers);
    const body = bodyNull ? null 
        : bodyText !== undefined ? bodyText
        : bodyBytes !== undefined ? bodyBytes
        : bodyId === undefined ? undefined 
        : bodyResolver(bodyId);
    if (status === 101) {
        if (!webSocketId) throw new Error(`unpackResponse: 101 responses must have a webSocketId`);
        const webSocket = webSocketResolver(webSocketId);
        return new DenoflareResponse(body, { status, headers, webSocket, url, redirected });
    }
    const rt = new _Response(body, { status, headers });
    Object.defineProperty(rt, 'url', { value: url });
    Object.defineProperty(rt, 'redirected', { value: redirected });
    return rt;
}

export function packRequest(info: RequestInfo, init: RequestInit | undefined, bodies: Bodies): PackedRequest {
    if (info instanceof URL) throw new Error(`Calling fetch(URL) is against the spec`);
    if (typeof info === 'object' && init === undefined) {
        // Request
        const { method, url, redirect } = info;
        const headers = [...info.headers.entries()];
        const bodyId = (method === 'GET' || method === 'HEAD') ? undefined : bodies.computeBodyId(info.body);
        return { method, url, headers, bodyId, bodyText: undefined, bodyBytes: undefined, bodyNull: false, redirect };
    } else if (typeof info === 'string') {
        // url String
        const url = info;
        let method = 'GET';
        let headers: [string, string][] = [];
        let redirect: RequestRedirect | undefined;
        let bodyId: number | undefined;
        let bodyText: string | undefined;
        let bodyBytes: Uint8Array | undefined;
        let bodyNull = false;
        if (init !== undefined) {
            if (init.method !== undefined) method = init.method;
            if (init.headers !== undefined) headers = [...new Headers(init.headers).entries()];
            if (init.body !== undefined) {
                if (typeof init.body === 'string') { bodyText = init.body; }
                else if (init.body instanceof Uint8Array) { bodyBytes = init.body; }
                else if (init.body instanceof ReadableStream) { bodyId = bodies.computeBodyId(init.body); }
                else if (init.body instanceof ArrayBuffer) { bodyBytes = new Uint8Array(new Uint8Array(init.body)); }
                else if (init.body === null) { bodyNull = true; }
                else { throw new Error(`packRequest: init.body`); }
            }
            if (init.cache !== undefined) throw new Error(`packRequest: init.cache`);
            if (init.credentials !== undefined) throw new Error(`packRequest: init.credentials`);
            if (init.integrity !== undefined) throw new Error(`packRequest: init.integrity`);
            if (init.keepalive !== undefined) throw new Error(`packRequest: init.keepalive`);
            if (init.mode !== undefined) throw new Error(`packRequest: init.mode`);
            if (init.referrer !== undefined) throw new Error(`packRequest: init.referrer`);
            if (init.referrerPolicy !== undefined) throw new Error(`packRequest: init.referrerPolicy`);
            if (init.signal !== undefined) throw new Error(`packRequest: init.signal`);
            if (init.window !== undefined) throw new Error(`packRequest: init.window`);
            redirect = init.redirect;
        }
        return { method, url, headers, bodyId, bodyText, bodyBytes, bodyNull, redirect };
    }
    throw new Error(`packRequest: implement info=${info} ${typeof info} init=${init}`);
}

export function unpackRequest(packedRequest: PackedRequest, bodyResolver: BodyResolver): Request {
    const { url, method, bodyId, bodyText, bodyBytes, bodyNull, redirect } = packedRequest;
    const headers = new Headers(packedRequest.headers);
    const body = bodyNull ? null 
        : bodyText !== undefined ? bodyText
        : bodyBytes !== undefined ? bodyBytes
        : bodyId === undefined ? undefined 
        : bodyResolver(bodyId);
    return new Request(url, { method, headers, body, redirect });
}

//

export interface PackedRequest {
    readonly method: string;
    readonly url: string;
    readonly headers: [string, string][];
    readonly bodyId: number | undefined;
    readonly bodyText: string | undefined;
    readonly bodyBytes: Uint8Array | undefined;
    readonly bodyNull: boolean;
    readonly redirect: RequestRedirect | undefined;
}

export interface PackedResponse {
    readonly status: number;
    readonly headers: [string, string][];
    readonly bodyId: number | undefined;
    readonly bodyText: string | undefined;
    readonly bodyBytes: Uint8Array | undefined;
    readonly bodyNull: boolean;
    readonly webSocketId: string | undefined;
    readonly url: string;
    readonly redirected: boolean;
}

export class Bodies {

    private readonly bodies = new Map<number, ReadableStream<Uint8Array>>();
    private readonly readers = new Map<number, ReadableStreamDefaultReader<Uint8Array>>();

    private nextBodyId = 1;

    computeBodyId(body: ReadableStream<Uint8Array> | null): number | undefined {
        if (!body) return undefined;
        const bodyId = this.nextBodyId++;
        this.bodies.set(bodyId, body);
        return bodyId;
    }

    async readBodyChunk(bodyId: number): Promise<ReadableStreamReadResult<Uint8Array>> {
        let reader = this.readers.get(bodyId);
        if (reader === undefined) {
            const body = this.bodies.get(bodyId);
            if (!body) throw new Error(`Bad bodyId: ${bodyId}`);
            reader = body.getReader();
            this.readers.set(bodyId, reader);
        }
        const result = await reader.read();
        if (result.done) {
            this.readers.delete(bodyId);
            this.bodies.delete(bodyId);
        }
        return result;
    }

}
