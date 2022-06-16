import { Mqtt } from './mqtt.ts';
import { MqttConnection } from './mqtt_connection.ts';

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
