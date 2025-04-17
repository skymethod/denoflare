import { Bytes } from './bytes.ts';
import { CloudflareResponseInitExtensions } from './cloudflare_workers_types.d.ts';

const _Response = Response;

type DenoflareResponseInit = ResponseInit & CloudflareResponseInitExtensions & { url?: string, redirected?: boolean };

export class DenoflareResponse {
    readonly _kind = 'DenoflareResponse';

    get bodyInit(): BodyInit | null | undefined { return this._bodyInit; } _bodyInit?: BodyInit | null;
    readonly init?: DenoflareResponseInit;
    readonly headers: Headers;
    readonly status: number;
    readonly statusText: string;
    readonly webSocket: WebSocket | undefined;
    readonly url: string;
    readonly redirected: boolean;

    constructor(bodyInit?: BodyInit | null, init?: DenoflareResponseInit) {
        // console.log(`DenoflareResponse()`, arguments);
        this._bodyInit = bodyInit;
        this.init = init;
        this.headers = init && init.headers ? new Headers(init.headers) : new Headers();
        this.status = init && init.status !== undefined ? init.status : 200;
        this.statusText = init && init.statusText !== undefined ? init.statusText : '';
        this.webSocket = init?.webSocket;

        // we must support both generated and received responses.  Generated responses have no url or redirected, received do.
        this.url = init?.url || ''; 
        this.redirected = init?.redirected || false;
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

    async arrayBuffer(): Promise<ArrayBuffer> {
        if (this.bodyInit instanceof ReadableStream) {
            return (await Bytes.ofStream(this.bodyInit)).array().buffer as ArrayBuffer;
        }
        throw new Error(`DenoflareResponse.arrayBuffer() bodyInit=${this.bodyInit}`);
    }

    get body(): ReadableStream<Uint8Array> | null {
        if (this.bodyInit === undefined || this.bodyInit === null) return null;
        if (this.bodyInit instanceof ArrayBuffer) {
            return new Blob([ this.bodyInit ]).stream();
        }
        throw new Error(`DenoflareResponse.body: bodyInit=${this.bodyInit}`);
    }

    clone(): DenoflareResponse {
        if (this.bodyInit instanceof ReadableStream) {
            // special handling, we need to change this instance's body as well
            const [ stream1, stream2 ] = this.bodyInit.tee();
            this._bodyInit = stream1;
            return new DenoflareResponse(stream2, cloneInit(this.init));
        }
        return new DenoflareResponse(cloneBodyInit(this.bodyInit), cloneInit(this.init));
    }

    get ok(): boolean { throw new Error(`DenoflareResponse.ok not implemented`); }
    get trailer(): Promise<Headers> { throw new Error(`DenoflareResponse.trailer not implemented`); }
    get type(): ResponseType { throw new Error(`DenoflareResponse.type not implemented`); }
    get bodyUsed(): boolean { throw new Error(`DenoflareResponse.bodyUsed not implemented`); }
    get blob(): Promise<Blob> { throw new Error(`DenoflareResponse.blob() not implemented`); }
    get formData(): Promise<FormData> { throw new Error(`DenoflareResponse.formData() not implemented`); }

    static json = _Response.json

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

function cloneBodyInit(bodyInit: BodyInit | null | undefined): BodyInit | null | undefined {
    if (bodyInit == undefined || bodyInit === null || typeof bodyInit === 'string') return bodyInit;
    if (typeof bodyInit === 'object') {
        if (bodyInit instanceof ArrayBuffer) {
            return bodyInit.slice(0);
        }
    }
    throw new Error(`cloneBodyInit(); bodyInit=${typeof bodyInit} ${bodyInit}`);
}

function cloneInit(init?: DenoflareResponseInit): DenoflareResponseInit | undefined {
    if (init === undefined) return init;
    if (init.webSocket) throw new Error(`cloneInit: Response with a websocket cannot be cloned`);
    const { status, statusText, url, redirected } = init;
    const headers = cloneHeadersInit(init.headers);
    return { headers, status, statusText, url, redirected };
}

function cloneHeadersInit(headers?: HeadersInit): HeadersInit | undefined {
    if (headers === undefined) return headers;
    if (headers instanceof Headers) {
        return new Headers(headers);
    }
    return JSON.parse(JSON.stringify(headers));
}
