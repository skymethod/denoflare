import { parseTailMessage, TailMessage, TailOptions } from './tail.ts';
import { formatLocalYyyyMmDdHhMmSs } from './tail_pretty.ts';

export class TailConnection {

    static VERBOSE = false;

    private readonly ws: WebSocket;
    private readonly callbacks: TailConnectionCallbacks;

    private options?: TailOptions
    private heartbeatId?: number;

    constructor(webSocketUrl: string, callbacks: TailConnectionCallbacks, opts: { websocketPingIntervalSeconds: number }) {
        this.ws = new WebSocket(webSocketUrl, 'trace-v1'); // else 406 Not Acceptable
        this.callbacks = callbacks;
        const { websocketPingIntervalSeconds } = opts;
        this.ws.addEventListener('open', event => {
            const { timeStamp } = event;
            this.sendOptionsIfOpen();
            if (callbacks.onOpen) {
                callbacks.onOpen(this, timeStamp);
            }
            if (websocketPingIntervalSeconds > 0) {
                if (TailConnection.VERBOSE) console.log(formatLocalYyyyMmDdHhMmSs(new Date()), `sending ws ping {} every ${websocketPingIntervalSeconds}`);
                this.heartbeatId = setInterval(() => {
                    if (this.ws.readyState === WebSocket.OPEN) {
                        if (TailConnection.VERBOSE) console.log(formatLocalYyyyMmDdHhMmSs(new Date()), `sending ws ping {}`);
                        this.ws.send('{}');
                    }
                }, websocketPingIntervalSeconds * 1000);
            }
        });
        this.ws.addEventListener('close', event => {
            const { code, reason, wasClean, timeStamp } = event;
            if (TailConnection.VERBOSE) console.log(formatLocalYyyyMmDdHhMmSs(new Date()), 'TailConnection: ws close', { code, reason, wasClean, timeStamp });
            clearInterval(this.heartbeatId);
            if (callbacks.onClose) {
                callbacks.onClose(this, timeStamp, code, reason, wasClean);
            }
        });
        this.ws.addEventListener('error', event => {
            const { timeStamp } = event;
            const errorInfo = computeErrorInfo(event);
            if (TailConnection.VERBOSE) console.log(formatLocalYyyyMmDdHhMmSs(new Date()), 'TailConnection: ws error', errorInfo);

            if (callbacks.onError) {
                callbacks.onError(this, timeStamp, errorInfo);
            }
        });
        this.ws.addEventListener('message', async event => {
            const { timeStamp } = event;
            if (event.data instanceof Blob) {
                const text = await event.data.text();
                const obj = JSON.parse(text); // only seen json object payloads
                let message: TailMessage;
                try {
                    message = parseTailMessage(obj);
                } catch (e) {
                    callbacks.onUnparsedMessage(this, timeStamp, obj, e as Error);
                    return;
                }
                callbacks.onTailMessage(this, timeStamp, message);
            } else {
                callbacks.onUnparsedMessage(this, timeStamp, event.data, new Error(`Expected event.data to be Blob`));
            }
        });
    }

    setOptions(options: TailOptions): TailConnection {
        this.options = options;
        this.sendOptionsIfOpen();
        return this;
    }

    close(code?: number, reason?: string) {
        this.ws.close(code, reason);
    }

    //

    private sendOptionsIfOpen() {
        if (this.options && this.ws.readyState === WebSocket.OPEN) {
            const payload = JSON.stringify(this.options);
            if (TailConnection.VERBOSE) console.log(`sendOptionsIfOpen: sending ${payload}`);
            this.ws.send(payload);
        }
    }
    
}

//

function computeErrorInfo(event: Event): ErrorInfo | undefined {
    if (event.type === 'error') {
        const { message, filename, lineno, colno, error } = event as ErrorEvent;
        return { message, filename, lineno, colno, error };
    }
    return undefined;
}

//

// deno-lint-ignore no-explicit-any
export type UnparsedMessage = any;

export interface TailConnectionCallbacks {
    onOpen?(cn: TailConnection, timeStamp: number): void;
    onClose?(cn: TailConnection, timeStamp: number, code: number, reason: string, wasClean: boolean): void;
    onError(cn: TailConnection, timeStamp: number, errorInfo?: ErrorInfo): void;
    onTailMessage(cn: TailConnection, timeStamp: number, message: TailMessage): void;
    onUnparsedMessage(cn: TailConnection, timeStamp: number, message: UnparsedMessage, parseError: Error): void;
}

export interface ErrorInfo {
    readonly message: string;
    readonly filename: string;
    readonly lineno: number;
    readonly colno: number;
    // deno-lint-ignore no-explicit-any
    readonly error: any;
}
