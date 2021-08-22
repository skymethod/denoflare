import { parseTailMessage, TailMessage, TailOptions } from './tail.ts';

export class TailConnection {

    static VERBOSE = false;

    private readonly ws: WebSocket;
    private readonly callbacks: TailConnectionCallbacks;

    private options?: TailOptions

    constructor(webSocketUrl: string, callbacks: TailConnectionCallbacks) {
        this.ws = new WebSocket(webSocketUrl, 'trace-v1'); // else 406 Not Acceptable
        this.callbacks = callbacks;
        this.ws.addEventListener('open', event => {
            const { timeStamp } = event;
            this.sendOptionsIfOpen();
            if (callbacks.onOpen) {
                callbacks.onOpen(this, timeStamp);
            }
        });
        this.ws.addEventListener('close', event => {
            const { code, reason, wasClean, timeStamp } = event;
            if (callbacks.onClose) {
                callbacks.onClose(this, timeStamp, code, reason, wasClean);
            }
        });
        this.ws.addEventListener('error', event => {
            const { timeStamp } = event;
            const errorInfo = computeErrorInfo(event);
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
                    callbacks.onUnparsedMessage(this, timeStamp, obj, e);
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

export interface TailConnectionCallbacks {
    onOpen?(cn: TailConnection, timeStamp: number): void;
    onClose?(cn: TailConnection, timeStamp: number, code: number, reason: string, wasClean: boolean): void;
    onError(cn: TailConnection, timeStamp: number, errorInfo?: ErrorInfo): void;
    onTailMessage(cn: TailConnection, timeStamp: number, message: TailMessage): void;
    // deno-lint-ignore no-explicit-any
    onUnparsedMessage(cn: TailConnection, timeStamp: number, message: any, parseError: Error): void;
}

export interface ErrorInfo {
    readonly message: string;
    readonly filename: string;
    readonly lineno: number;
    readonly colno: number;
    // deno-lint-ignore no-explicit-any
    readonly error: any;
}
