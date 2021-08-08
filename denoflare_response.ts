import { DenoflareServerWebSocket, DenoflareServerWebSocketLocator, isDenoflareServerWebSocketLocator } from './denoflare_server_web_socket.ts';
import { CloudflareResponseInitExtensions } from './deps_cf.ts';

export class DenoflareResponse implements DenoflareServerWebSocketLocator {
    readonly _kind = 'DenoflareResponse';

    readonly body?: BodyInit | null;
    readonly init?: ResponseInit & CloudflareResponseInitExtensions;
    readonly headers: Headers;

    constructor(body?: BodyInit | null, init?: ResponseInit & CloudflareResponseInitExtensions) {
        // consoleLog(`DenoflareResponse()`, arguments);
        this.body = body;
        this.init = init;
        this.headers = init && init.headers ? new Headers(init.headers) : new Headers();
    }

    // deno-lint-ignore no-explicit-any
    json(): Promise<any> {
        if (typeof this.body === 'string') {
            return Promise.resolve(JSON.parse(this.body));
        }
        throw new Error(`DenoflareResponse.json() body=${this.body}`);
    }

    //

    toRealResponse(): Response {
        return new _Response(this.body, this.init);
    }

    getDenoflareServerWebSocket(): DenoflareServerWebSocket | undefined {
        return this.init && this.init.webSocket && isDenoflareServerWebSocketLocator(this.init.webSocket) 
            ? this.init.webSocket.getDenoflareServerWebSocket() 
            : undefined;
    }

    // deno-lint-ignore no-explicit-any
    static is(obj: any): obj is DenoflareResponse {
        return typeof obj === 'object' && obj._kind === 'DenoflareResponse';
    }

}

//

const _Response = Response;
