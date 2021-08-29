import { CloudflareWebSocketExtensions } from './cloudflare_workers_types.d.ts';
import { consoleLog, consoleWarn } from './console.ts';

export class DenoflareServerWebSocket implements CloudflareWebSocketExtensions {
    private readonly pendingOps: Op[] = [];

    private accepted = false;
    private websocket?: WebSocket;

    accept() {
        if (this.accepted) throw new Error('accept(): already accepted');
        consoleLog(`DenoflareServerWebSocket.accept`);
        this.accepted = true;
        this.flushPendingOps();
    }

    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        if (this.accepted && this.websocket) this.websocket.send(data);
        consoleLog(`DenoflareServerWebSocket.send data=${data}`);
        this.pendingOps.push({ kind: 'send', data });
    }

    close(code?: number, reason?: string): void {
        //  The close code must be either 1000 or in the range of 3000 to 4999.
        // https://github.com/denoland/deno/issues/11611
        if (typeof code === 'number' && code > 1000 && code < 3000) {
            consoleWarn(`WARNING: Deno currently supports WebSocket.close codes of 1000 or 3000-4999, sending 1000 instead of ${code}`);
            code = 1000;
        }
        if (this.accepted && this.websocket) this.websocket.close(code, reason);
        consoleLog(`DenoflareServerWebSocket.close code=${code}, reason=${reason}`);
        this.pendingOps.push({ kind: 'close', code, reason });
    }

    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
        if (this.accepted && this.websocket) this.websocket.addEventListener(type, listener, options);
        consoleLog(`DenoflareServerWebSocket.addEventListener type=${type}, listener=${listener}, options=${JSON.stringify(options)}`);
        this.pendingOps.push({ kind: 'add-event-listener', type, listener, options });
    }

    //

    setRealWebsocket(websocket: WebSocket) {
        this.websocket = websocket;
        websocket.onopen = () => {
            consoleLog('DenoflareServerWebSocket: socket opened');
            this.flushPendingOps();
        };
        websocket.onmessage = (e) => {
            consoleLog('DenoflareServerWebSocket: socket message:', e.data);
        };
        websocket.onerror = (e) => consoleLog('DenoflareServerWebSocket: socket errored:', e);
        websocket.onclose = () => consoleLog('DenoflareServerWebSocket: socket closed');
        this.flushPendingOps();
    }

    //

    private flushPendingOps() {
        if (this.accepted && this.websocket && this.websocket.readyState === WebSocket.OPEN && this.pendingOps.length > 0) {
            consoleLog('DenoflareServerWebSocket: flushPendingOps()');
            for (const op of this.pendingOps) {
                if (op.kind === 'send') {
                    this.websocket.send(op.data);
                } else if (op.kind === 'close') {
                    this.websocket.close(op.code, op.reason);
                } else if (op.kind === 'add-event-listener') {
                    this.websocket.addEventListener(op.type, op.listener, op.options);
                } else {
                    throw new Error(`Unsupported op: ${JSON.stringify(op)}`);
                }
            }
            this.pendingOps.splice(0);
        }
    }

}

export interface DenoflareServerWebSocketLocator {
    getDenoflareServerWebSocket(): DenoflareServerWebSocket | undefined;
}

// deno-lint-ignore no-explicit-any
export function isDenoflareServerWebSocketLocator(obj: any): obj is DenoflareServerWebSocketLocator {
    return typeof obj === 'object' && typeof obj.getDenoflareServerWebSocket === 'function';
}

//

type Op = SendOp | CloseOp | AddEventListenerOp;

interface SendOp {
    readonly kind: 'send';
    readonly data: string | ArrayBufferLike | Blob | ArrayBufferView
}

interface CloseOp {
    readonly kind: 'close';
    readonly code?: number;
    readonly reason?: string
}

interface AddEventListenerOp {
    readonly kind: 'add-event-listener';
    readonly type: string;
    readonly listener: EventListenerOrEventListenerObject;
    readonly options?: boolean | AddEventListenerOptions;
}
