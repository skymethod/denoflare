import { Mqtt } from './mqtt.ts';

export interface MqttConnection {
    write(bytes: Uint8Array): Promise<number>;
    onRead: (bytes: Uint8Array) => void;
    readonly completionPromise: Promise<void>;
    close(): void;
}

export class DenoTcpConnection implements MqttConnection {

    readonly completionPromise: Promise<void>;

    onRead: (bytes: Uint8Array) => void = () => {};

    private readonly conn: Deno.TlsConn;

    private closed = false;

    private constructor(conn: Deno.TlsConn) {
        this.conn = conn;
        this.completionPromise = this.initCompletionPromise();
    }

    private initCompletionPromise(): Promise<void> {
        const { DEBUG } = Mqtt;
        return (async () => {
            while (true) {
                const buffer = new Uint8Array(8 * 1024);
                if (DEBUG) console.log('before read');
                const result = await this.read(buffer);
                if (result === null) {
                    if (DEBUG) console.log('EOF');
                    return;
                }
                if (DEBUG) console.log(`Received ${result} bytes`);
                this.onRead(buffer.slice(0, result));
            }
        })();
    }

    private async read(buffer: Uint8Array): Promise<number|null> {
        try {
            return await this.conn.read(buffer);
        } catch (e) {
            if (this.closed) return null; // BadResource: Bad resource ID
            throw e;
        }
    }

    static async create(opts: { hostname: string, port: number }): Promise<DenoTcpConnection> {
        const { hostname, port } = opts;
        const connection = await Deno.connectTls({ hostname, port });
        return new DenoTcpConnection(connection);
    }

    async write(bytes: Uint8Array): Promise<number> {
        return await this.conn.write(bytes);
    }

    close() {
        this.closed = true;
        this.conn.close();
    }

}

export class WebSocketConnection implements MqttConnection {

    readonly completionPromise: Promise<void>;

    onRead: (bytes: Uint8Array) => void = () => {};

    private readonly ws: WebSocket;

    private constructor(ws: WebSocket) {
        const { DEBUG } = Mqtt;
        this.ws = ws;
        this.completionPromise = new Promise((resolve, reject) => {
            ws.addEventListener('close', event => {
                if (DEBUG) console.log('ws close', event);
                resolve();
            });
            ws.addEventListener('error', event => {
                if (DEBUG) console.log('ws error', event);
                // deno-lint-ignore no-explicit-any
                reject((event as any).message ?? event);
            });
        });
        ws.addEventListener('message', async event => {
            if (DEBUG) console.log('ws message', typeof event.data, event.data);
            if (event.data instanceof Blob) {
                const bytes = new Uint8Array(await event.data.arrayBuffer());
                this.onRead(bytes);
            }
        });
    }

    static create(opts: { hostname: string, port: number }): Promise<WebSocketConnection> {
        const { DEBUG } = Mqtt;
        const { hostname, port } = opts;

        const ws = new WebSocket(`wss://${hostname}:${port}`);
        return new Promise((resolve, reject) => {
            let resolved = false;
            ws.addEventListener('open', event => {
                if (resolved) return;
                if (DEBUG) console.log('ws open', event);
                resolved = true;
                resolve(new WebSocketConnection(ws));
            });
            ws.addEventListener('error', event => {
                if (resolved) return;
                if (DEBUG) console.log('ws error', event);
                resolved = true;
                reject(event);
            });
        });
    }

    write(bytes: Uint8Array): Promise<number> {
        this.ws.send(bytes);
        return Promise.resolve(bytes.length);
    }
    
    close() {
        this.ws.close();
    }

}
