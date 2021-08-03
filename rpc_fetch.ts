import { RpcChannel } from './rpc_channel.ts';

export function makeFetchOverRpc(channel: RpcChannel, bodies: Bodies): (info: RequestInfo, init?: RequestInit) => Promise<Response> {
    return async (info: RequestInfo, init?: RequestInit) => {
        const data = packRequest(info, init, bodies);
        return await channel.sendRequest('fetch', data, responseData => unpackResponse(responseData, makeBodyResolverOverRpc(channel)));
    }
}

export function makeBodyResolverOverRpc(channel: RpcChannel): BodyResolver {
    return bodyId => new ReadableStream({
        start(_controller)  {
            // _consoleLog(`RpcBodyResolver(${bodyId}): start controller.desiredSize=${controller.desiredSize}`);
        },
        async pull(controller): Promise<void> {
            // _consoleLog(`RpcBodyResolver(${bodyId}): pull controller.desiredSize=${controller.desiredSize}`);
            const { value, done } = await channel.sendRequest('read-body-chunk', { bodyId }, responseData => {
                return responseData as ReadableStreamReadResult<Uint8Array>;
            });
            if (value !== undefined) controller.enqueue(value);
            if (done) controller.close();
        },
        cancel(reason) {
            _consoleLog(`RpcBodyResolver(${bodyId}): cancel reason=${reason}`);
        },
    });
}

export function setReadBodyChunkRequestHandler(channel: RpcChannel, bodies: Bodies) {
    channel.addRequestHandler('read-body-chunk', async requestData => {
        const { bodyId } = requestData;
        const { value, done } = await bodies.readBodyChunk(bodyId);
        return { value, done };
    });
}

export type BodyResolver = (bodyId: number) => ReadableStream<Uint8Array>;

export function packResponse(response: Response, bodies: Bodies): PackedResponse {
    const { status } = response;
    const headers = [...response.headers.entries()];
    const bodyId = bodies.computeBodyId(response.body);
    return { status, headers, bodyId };
}

export function unpackResponse(packed: PackedResponse, bodyResolver: BodyResolver): Response {
    const { status, bodyId } = packed;
    const headers = new Headers(packed.headers);
    const body = bodyId === undefined ? undefined : bodyResolver(bodyId);
    return new Response(body, { status, headers });
}

export function packRequest(info: RequestInfo, init: RequestInit |  undefined, bodies: Bodies): PackedRequest {
    if (typeof info === 'object' && init === undefined) {
        // Request
        const { method, url } = info;
        const headers = [...info.headers.entries()];
        const bodyId = bodies.computeBodyId(info.body);
        return { method, url, headers, bodyId };
    }
    throw new Error(`packRequest: implement info=${info} ${typeof info} init=${init}`);
}

export function unpackRequest(packedRequest: PackedRequest, bodyResolver: BodyResolver): Request {
    const { url, method, bodyId } = packedRequest;
    const headers = new Headers(packedRequest.headers);
    const body = bodyId === undefined ? undefined : bodyResolver(bodyId);
    return new Request(url, { method, headers, body });
}

//

const _consoleLog = console.log;

//

export interface PackedRequest {
    readonly method: string;
    readonly url: string;
    readonly headers: [string, string][];
    readonly bodyId: number | undefined;
}

export interface PackedResponse {
    readonly status: number;
    readonly headers: [string, string][];
    readonly bodyId: number | undefined;
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
