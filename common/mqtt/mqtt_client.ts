import { Bytes } from '../bytes.ts';
import { checkEqual } from '../check.ts';
import { hex, Mqtt } from './mqtt.ts';
import { DenoTcpConnection, MqttConnection, WebSocketConnection } from './mqtt_connection.ts';
import { computeControlPacketTypeName, CONNACK, CONNECT, DISCONNECT, encodeMessage, MqttMessage, PINGREQ, PINGRESP, PUBLISH, Reader, readMessage, SUBACK, SUBSCRIBE } from './mqtt_messages.ts';

export type Protocol = 'mqtts' | 'wss';

export class MqttClient {

    readonly hostname: string;
    readonly port: number;
    readonly protocol: Protocol;

    onMqttMessage?: (message: MqttMessage) => void;
    onReceive?: (opts: { topic: string, payload: string | Uint8Array, contentType?: string }) => void;

    private readonly packetIds = new Array<boolean>(256 * 256);
    private readonly pendingSubscribes: Record<number, Signal> = {};
    private readonly savedBytes: number[] = [];

    private connection?: MqttConnection;
    private pingTimeout = 0;
    private pendingConnect?: Signal;
    private connectionCompletion?: Promise<void>;

    constructor(opts: { hostname: string, port: number, protocol: Protocol }) {
        const { hostname, port, protocol = 'mqtts' } = opts;
        this.hostname = hostname;
        this.port = port;
        this.protocol = protocol;
    }

    completion(): Promise<void> {
        return this.connectionCompletion ?? Promise.resolve();
    }

    connected(): boolean {
        return this.connection !== undefined;
    }

    async connect(opts: { clientId?: string, username?: string, password: string, keepAlive?: number }): Promise<void> {
        const { DEBUG } = Mqtt;
        const { clientId = '', username, password, keepAlive = 10 } = opts;

        const { protocol, hostname, port } = this;
        if (!this.connection) {
            this.connection = protocol === 'mqtts' ? await DenoTcpConnection.create({ hostname, port }) : await WebSocketConnection.create({ hostname, port });
            this.connection.onRead = bytes => {
                this.processBytes(bytes);
            }
            this.connectionCompletion = this.connection.completionPromise
                .then(() => { 
                    if (DEBUG) console.log('read loop done'); 
                    this.clearPing(); 
                    this.connection = undefined;
                // deno-lint-ignore no-explicit-any
                }, (e: any) => { 
                    console.log(`unhandled read loop error: ${e.stack || e}`); 
                    this.clearPing(); 
                });
        }
        
        this.pendingConnect = new Signal();
        await this.sendMessage({ type: CONNECT, clientId, username, password, keepAlive });
        return this.pendingConnect.promise;  // wait for CONNACK
    }

    async disconnect(): Promise<void> {
        await this.sendMessage({ type: DISCONNECT, reason: { code: 0x00 /* normal disconnection */ } });
        this.connection = undefined;
    }

    async publish(opts: { topic: string, payload: string | Uint8Array, contentType?: string }): Promise<void> {
        const { topic, payload: inputPayload, contentType } = opts;

        const payloadFormatIndicator = typeof inputPayload === 'string' ? 1 : 0;
        const payload = typeof inputPayload === 'string' ? Bytes.ofUtf8(inputPayload).array() : inputPayload;

        await this.sendMessage({ type: PUBLISH, dup: false, qosLevel: 0, retain: false, topic, payload, payloadFormatIndicator, contentType });
        // we only support qos for now, so no need to wait for ack
    }

    async subscribe(opts: { topicFilter: string }): Promise<void> {
        const { topicFilter } = opts;

        const packetId = this.obtainPacketId();

        const signal = new Signal();
        this.pendingSubscribes[packetId] = signal;

        await this.sendMessage({ type: SUBSCRIBE, packetId, subscriptions: [ { topicFilter } ] }); 

        return signal.promise; // wait for SUBACK
    }

    //

    private async ping(): Promise<void> {
        await this.sendMessage({ type: PINGREQ });
    }

    private obtainPacketId(): number {
        const { DEBUG } = Mqtt;
        const { packetIds } = this;
        for (let packetId = 1; packetId < packetIds.length; packetId++) {
            if (!packetIds[packetId]) {
                packetIds[packetId] = true;
                if (DEBUG) console.log(`Obtained packetId: ${packetId}`);
                return packetId;
            }
        }
        throw new Error(`obtainPacketId: Unable to obtain a packet id`);
    }

    private releasePacketId(packetId: number) {
        const { DEBUG } = Mqtt;
        const { packetIds } = this;
        if (packetId < 1 || packetId >= packetIds.length) throw new Error(`releasePacketId: Bad packetId: ${packetId}`);
        if (!packetIds[packetId]) throw new Error(`releasePacketId: Unobtained packetId: ${packetId}`);
        if (DEBUG) console.log(`Released packetId: ${packetId}`);
        packetIds[packetId] = false;
    }

    private processBytes(bytes: Uint8Array) {
        const { DEBUG } = Mqtt;
        if (this.savedBytes.length > 0) {
            bytes = new Uint8Array([...this.savedBytes, ...bytes]);
            this.savedBytes.splice(0);
        }
        if (DEBUG) console.log('processBytes', bytes.length + ' bytes');
        if (DEBUG) console.log(hex(bytes));

        const reader = new Reader(bytes, 0);
        while (reader.remaining() > 0) {
            const start = reader.position;
            const message = readMessage(reader);
            if ('needsMoreBytes' in message) {
                this.savedBytes.push(...bytes.slice(start));
                return;
            }
            if (message.type === CONNACK) {
                if (this.pendingConnect) {
                    if ((message.reason?.code ?? 0) < 0x80) {
                        this.pendingConnect.resolve();
                    } else {
                        this.pendingConnect.reject(JSON.stringify(message.reason));
                    }
                    this.pendingConnect = undefined;
                }
            } else if (message.type === DISCONNECT) {
                if (this.connection) {
                    this.connection.close();
                    this.connection = undefined;
                }
            } else if (message.type === SUBACK) {
                const { packetId, reasons } = message;
                this.releasePacketId(packetId);
                const signal = this.pendingSubscribes[packetId];
                if (signal) {
                    if (reasons.some(v => v.code >= 0x80)) {
                        signal.reject(JSON.stringify(reasons));
                    } else {
                        signal.resolve();
                    }
                    delete this.pendingSubscribes[packetId];
                }
                this.reschedulePing();
            } else if (message.type === PINGRESP) {
                // noop
            } else if (message.type === PUBLISH) {
                const { topic, payload: messagePayload, payloadFormatIndicator, contentType } = message;
                const payload = payloadFormatIndicator === 1 ? new Bytes(messagePayload).utf8() : messagePayload;
                if (this.onReceive) this.onReceive({ topic, payload, contentType });
            } else {
                throw new Error(`processPacket: Unsupported message type: ${message}`);
            }
            if (this.onMqttMessage) this.onMqttMessage(message);
        }
        checkEqual('reader.remaining', reader.remaining(), 0);
    }

    private clearPing() {
        clearTimeout(this.pingTimeout);
    }

    private reschedulePing() {
        this.clearPing();
        this.pingTimeout = setTimeout(async () => {
            await this.ping();
            this.reschedulePing();
        }, 10_000);
    }

    private async sendMessage(message: MqttMessage): Promise<void> {
        const { DEBUG } = Mqtt;
        const { connection } = this;
        if (DEBUG) console.log(`Sending ${computeControlPacketTypeName(message.type)}`);
        if (!connection) throw new Error(`sendMessage: not connected`);
        await connection.write(encodeMessage(message));
    }

}

//

class Signal {

    readonly promise: Promise<void>;

    private resolve_!: (value: void | PromiseLike<void>) => void;
    private reject_!: (reason: unknown) => void;

    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.resolve_ = resolve;
            this.reject_ = reject;
        });
    }

    resolve() {
        this.resolve_();
    }

    reject(reason: unknown) {
        this.reject_(reason);
    }

}
