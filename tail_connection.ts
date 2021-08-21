import { parseTailMessage, TailMessage, TailOptions } from './tail.ts';

export class TailConnection {

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
            if (callbacks.onError) {
                callbacks.onError(this, timeStamp, event);
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
            this.ws.send(JSON.stringify(this.options));
        }
    }
    
}

export interface TailConnectionCallbacks {
    onOpen?(cn: TailConnection, timeStamp: number): void;
    onClose?(cn: TailConnection, timeStamp: number, code: number, reason: string, wasClean: boolean): void;
    onError(cn: TailConnection, timeStamp: number, event: Event): void;
    onTailMessage(cn: TailConnection, timeStamp: number, message: TailMessage): void;
    // deno-lint-ignore no-explicit-any
    onUnparsedMessage(cn: TailConnection, timeStamp: number, message: any, parseError: Error): void;
}
