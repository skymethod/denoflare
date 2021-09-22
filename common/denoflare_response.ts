import { CloudflareResponseInitExtensions } from './cloudflare_workers_types.d.ts';

export class DenoflareResponse {
    readonly _kind = 'DenoflareResponse';

    readonly bodyInit?: BodyInit | null;
    readonly init?: ResponseInit & CloudflareResponseInitExtensions;
    readonly headers: Headers;
    readonly status: number;
    readonly webSocket: WebSocket | undefined;

    constructor(bodyInit?: BodyInit | null, init?: ResponseInit & CloudflareResponseInitExtensions) {
        // console.log(`DenoflareResponse()`, arguments);
        this.bodyInit = bodyInit;
        this.init = init;
        this.headers = init && init.headers ? new Headers(init.headers) : new Headers();
        this.status = init && init.status !== undefined ? init.status : 200;
        this.webSocket = init?.webSocket;
    }

    // deno-lint-ignore no-explicit-any
    json(): Promise<any> {
        if (typeof this.bodyInit === 'string') {
            return Promise.resolve(JSON.parse(this.bodyInit));
        }
        throw new Error(`DenoflareResponse.json() bodyInit=${this.bodyInit}`);
    }

    text(): Promise<string> {
        if (typeof this.bodyInit === 'string') {
            return Promise.resolve(this.bodyInit);
        }
        if (typeof this.bodyInit === 'object') {
            if (this.bodyInit instanceof ArrayBuffer) {
                return Promise.resolve(new TextDecoder().decode(this.bodyInit));
            }
        }
        throw new Error(`DenoflareResponse.text() bodyInit=${this.bodyInit}`);
    }

    get body(): ReadableStream<Uint8Array> | null {
        if (this.bodyInit === undefined || this.bodyInit === null) return null;
        if (this.bodyInit instanceof ArrayBuffer) {
            return new Blob([ this.bodyInit ]).stream();
        }
        throw new Error(`DenoflareResponse.body: bodyInit=${this.bodyInit}`);
    }

    clone(): DenoflareResponse {
        return new DenoflareResponse(cloneBodyInit(this.bodyInit), cloneInit(this.init));
    }

    get ok(): boolean { throw new Error(`DenoflareResponse.ok not implemented`); }
    get redirected(): boolean { throw new Error(`DenoflareResponse.redirected not implemented`); }
    get statusText(): string { throw new Error(`DenoflareResponse.statusText not implemented`); }
    get trailer(): Promise<Headers> { throw new Error(`DenoflareResponse.trailer not implemented`); }
    get type(): ResponseType { throw new Error(`DenoflareResponse.type not implemented`); }
    get url(): string { throw new Error(`DenoflareResponse.url not implemented`); }
    get bodyUsed(): boolean { throw new Error(`DenoflareResponse.bodyUsed not implemented`); }
    get arrayBuffer(): Promise<ArrayBuffer> { throw new Error(`DenoflareResponse.arrayBuffer() not implemented`); }
    get blob(): Promise<Blob> { throw new Error(`DenoflareResponse.blob() not implemented`); }
    get formData(): Promise<FormData> { throw new Error(`DenoflareResponse.formData() not implemented`); }

    //

    toRealResponse(): Response {
        return new _Response(this.bodyInit, this.init);
    }

    // deno-lint-ignore no-explicit-any
    static is(obj: any): obj is DenoflareResponse {
        return typeof obj === 'object' && obj._kind === 'DenoflareResponse';
    }

}

//

const _Response = Response;

function cloneBodyInit(bodyInit: BodyInit | null | undefined): BodyInit | null | undefined {
    if (bodyInit == undefined || bodyInit === null || typeof bodyInit === 'string') return bodyInit;
    if (typeof bodyInit === 'object') {
        if (bodyInit instanceof ArrayBuffer) {
            return bodyInit.slice(0);
        }
    }
    throw new Error(`cloneBodyInit(); bodyInit=${typeof bodyInit} ${bodyInit}`);
}

function cloneInit(init?: ResponseInit & CloudflareResponseInitExtensions): ResponseInit & CloudflareResponseInitExtensions | undefined {
    if (init === undefined) return init;
    if (init.webSocket) throw new Error(`cloneInit: Response with a websocket cannot be cloned`);
    const { status, statusText } = init;
    const headers = cloneHeadersInit(init.headers);
    return { headers, status, statusText };
}

function cloneHeadersInit(headers?: HeadersInit): HeadersInit | undefined {
    if (headers === undefined) return headers;
    if (headers instanceof Headers) {
        return new Headers(headers);
    }
    return JSON.parse(JSON.stringify(headers));
}
