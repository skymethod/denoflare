import { Mqtt } from './mqtt.ts';
import { MqttClient } from './mqtt_client.ts';
import { MqttConnection } from './mqtt_connection.ts';

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

    //
    
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

    static register() {
        MqttClient.protocolHandlers['mqtts'] = DenoTcpConnection.create;
    }

}
