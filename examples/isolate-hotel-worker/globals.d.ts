import { CloudflareWebSocketExtensions } from './deps_worker.ts';

export {};

declare global {

    // https://developers.cloudflare.com/workers/runtime-apis/websockets

    interface Response {
        // non-standard member
        webSocket?: WebSocket & CloudflareWebSocketExtensions; 
    }

    // non-standard class, only on CF
    class WebSocketPair {
        0: WebSocket & CloudflareWebSocketExtensions;
        1: WebSocket & CloudflareWebSocketExtensions;
    }

    interface ResponseInit {
        // non-standard member
        webSocket?: WebSocket; 
    }

}
