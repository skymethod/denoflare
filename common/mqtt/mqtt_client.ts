import { Bytes } from '../bytes.ts';
import { checkEqual } from '../check.ts';
import { hex, Mqtt } from './mqtt.ts';
import { DenoTcpConnection, MqttConnection, WebSocketConnection } from './mqtt_connection.ts';
import { computeControlPacketTypeName, CONNACK, CONNECT, DISCONNECT, encodeMessage, MqttMessage, PINGREQ, PINGRESP, PUBLISH, Reader, readMessage, SUBACK, SUBSCRIBE } from './mqtt_messages.ts';

export type Protocol = 'mqtts' | 'wss';

const DEFAULT_KEEP_ALIVE_SECONDS = 10;
const MAX_PACKET_IDS = 256 * 256;

/**
 * Lightweight MQTT v5 client.
 * 
 * Supports MQTT over WebSockets (wss) in the browser and Node, and also over TCP (mqtts) in Deno.
 */
export class MqttClient {

    readonly hostname: string;
    readonly port: number;
    readonly protocol: Protocol;

    get clientId(): string | undefined { return this.clientIdInternal; }
    get keepAlive(): number | undefined { return this.keepAliveSeconds; }

    onMqttMessage?: (message: MqttMessage) => void;
    onReceive?: (opts: { topic: string, payload: string | Uint8Array, contentType?: string }) => void;

    private readonly obtainedPacketIds: number[] = [];
    private readonly pendingSubscribes: Record<number, Signal> = {};
    private readonly savedBytes: number[] = [];
    private readonly maxMessagesPerSecond?: number;

    private connection?: MqttConnection;
    private pingTimeout = 0;
    private keepAliveSeconds = DEFAULT_KEEP_ALIVE_SECONDS;
    private pendingConnect?: Signal;
    private connectionCompletion?: Promise<void>;
    private lastSentMessageTime = 0;
    private receivedDisconnect = false;
    private clientIdInternal: string | undefined;
    private nextPacketId = 1;

    constructor(opts: { hostname: string, port: number, protocol: Protocol, maxMessagesPerSecond?: number }) {
        const { hostname, port, protocol = 'mqtts', maxMessagesPerSecond } = opts;
        this.hostname = hostname;
        this.port = port;
        this.protocol = protocol;
        this.maxMessagesPerSecond = maxMessagesPerSecond;
    }

    completion(): Promise<void> {
        return this.connectionCompletion ?? Promise.resolve();
    }

    connected(): boolean {
        return this.connection !== undefined;
    }

    async connect(opts: { clientId?: string, username?: string, password: string, keepAlive?: number }): Promise<void> {
        const { DEBUG } = Mqtt;
        const { clientId = '', username, password, keepAlive = DEFAULT_KEEP_ALIVE_SECONDS } = opts;

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
        this.keepAliveSeconds = keepAlive;
        this.clientIdInternal = clientId;
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
        const { nextPacketId, obtainedPacketIds } = this;
        for (let i = 0; i < MAX_PACKET_IDS; i++) {
            const candidate = (nextPacketId + i) % MAX_PACKET_IDS;
            if (candidate !== 0 && !obtainedPacketIds.includes(candidate)) {
                obtainedPacketIds.push(candidate);
                if (DEBUG) console.log(`Obtained packetId: ${candidate}`);
                this.nextPacketId = (candidate + 1) % MAX_PACKET_IDS;
                return candidate;
            }
        }
        throw new Error(`obtainPacketId: Unable to obtain a packet id`);
    }

    private releasePacketId(packetId: number) {
        const { DEBUG } = Mqtt;
        const { obtainedPacketIds } = this;
        if (packetId < 1 || packetId >= MAX_PACKET_IDS) throw new Error(`releasePacketId: Bad packetId: ${packetId}`);
        const i = obtainedPacketIds.indexOf(packetId);
        if (i < 0) throw new Error(`releasePacketId: Unobtained packetId: ${packetId}`);
        obtainedPacketIds.splice(i, 1);
        if (DEBUG) console.log(`Released packetId: ${packetId}`);
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
                        this.clientIdInternal = message.assignedClientIdentifier ?? this.clientIdInternal;
                        this.keepAliveSeconds = message.serverKeepAlive ?? this.keepAliveSeconds;
                        this.reschedulePing();
                        this.pendingConnect.resolve();
                    } else {
                        this.pendingConnect.reject(JSON.stringify(message.reason));
                    }
                    this.pendingConnect = undefined;
                }
            } else if (message.type === DISCONNECT) {
                this.receivedDisconnect = true;
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
        }, this.keepAliveSeconds * 1000);
    }

    private async sendMessage(message: MqttMessage): Promise<void> {
        const { DEBUG } = Mqtt;
        const { connection, maxMessagesPerSecond } = this;
        const diff =  Date.now() - this.lastSentMessageTime;
        const intervalMillis = 1000 / (maxMessagesPerSecond ?? 1);
        const waitMillis = maxMessagesPerSecond !== undefined && diff < intervalMillis ? intervalMillis - diff : 0;
        if (DEBUG) console.log(`Sending ${computeControlPacketTypeName(message.type)}${waitMillis > 0 ? ` (waiting ${waitMillis}ms)` : ''}`);
        if (waitMillis > 0) await sleep(waitMillis);
        if (this.receivedDisconnect) throw new Error(`sendMessage: received disconnect`);
        if (!connection) throw new Error(`sendMessage: no connection`);
        await connection.write(encodeMessage(message));
        this.lastSentMessageTime = Date.now();
    }

}

//

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
