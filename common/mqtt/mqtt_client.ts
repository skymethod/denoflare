import { Bytes } from '../bytes.ts';
import { checkEqual } from '../check.ts';
import { hex, Mqtt } from './mqtt.ts';
import { DenoTcpConnection, MqttConnection, WebSocketConnection } from './mqtt_connection.ts';
import { computeControlPacketTypeName, CONNACK, CONNECT, DISCONNECT, encodeMessage, MqttMessage, PINGREQ, PINGRESP, PUBLISH, Reader, readMessage, SUBACK, SUBSCRIBE } from './mqtt_messages.ts';

// https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html

export type ConnectionAcknowledgedOpts = { 
    reason?: Reason,
    sessionPresent: boolean,
    sessionExpiryInterval?: number, 
    maximumQos?: 0 | 1, 
    retainAvailable?: boolean, 
    maximumPacketSize?: number, 
    topicAliasMaximum?: number, 
    wildcardSubscriptionAvailable?: boolean, 
    subscriptionIdentifiersAvailable?: boolean, 
    sharedSubscriptionAvailable?: boolean,
    serverKeepAlive?: number,
    assignedClientIdentifier?: string,
};

export type Reason = { code: number, name?: string, description?: string };

export type DisconnectedOpts = {
    reason?: Reason,
};

// deno-lint-ignore ban-types
export type SubscriptionAcknowledgedOpts = { 
    
};

export type PublishOpts = {
    topic: string,
    payloadFormatIndicator?: number,
    payload: Uint8Array,
    contentType?: string,
};

export class MqttClient {

    readonly hostname: string;
    readonly port: number;
    readonly readLoop: Promise<void>;

    onConnectionAcknowledged?: (opts: ConnectionAcknowledgedOpts) => void;
    onDisconnected?: (opts: DisconnectedOpts) => void;
    onSubscriptionAcknowledged?: (opts: SubscriptionAcknowledgedOpts) => void;
    onPublish?: (opts: PublishOpts) => void;

    private readonly connection: MqttConnection;
    private readonly packetIds = new Array<boolean>(256 * 256);
    
    private pingTimeout = 0;

    private constructor(hostname: string, port: number, connection: MqttConnection) {
        this.hostname = hostname;
        this.port = port;
        this.connection = connection;
        this.readLoop = this.initReadLoop();
    }

    private initReadLoop(): Promise<void> {
        const { DEBUG } = Mqtt;
        this.connection.onRead = bytes => {
            this.processBytes(bytes);
        }
        return this.connection.completionPromise
            // deno-lint-ignore no-explicit-any
            .then(() => { if (DEBUG) console.log('read loop done'); this.clearPing(); }, (e: any) => { console.log(`unhandled read loop error: ${e.stack || e}`); this.clearPing(); });
    }

    static async create(opts: { hostname: string, port: number, protocol: 'mqtts' | 'wss' }): Promise<MqttClient> {
        const { hostname, port, protocol } = opts;
        const connection = protocol === 'mqtts' ? await DenoTcpConnection.create({ hostname, port }) : await WebSocketConnection.create({ hostname, port });
        return new MqttClient(hostname, port, connection);
    }

    async connect(opts: { clientId: string, username?: string, password: string, keepAlive?: number }): Promise<void> {
        const { clientId, username, password, keepAlive = 10 } = opts;

        await this.sendMessage({ type: CONNECT, clientId, username, password, keepAlive });
    }

    async disconnect(): Promise<void> {
        await this.sendMessage({ type: DISCONNECT, reason: { code: 0x00 /* normal disconnection */ } });
    }

    async publish(opts: { topic: string, payload: string | Uint8Array, contentType?: string }): Promise<void> {
        const { topic, payload: inputPayload, contentType } = opts;

        const payloadFormatIndicator = typeof inputPayload === 'string' ? 1 : 0;
        const payload = typeof inputPayload === 'string' ? Bytes.ofUtf8(inputPayload).array() : inputPayload;

        await this.sendMessage({ type: PUBLISH, dup: false, qosLevel: 0, retain: false, topic, payload, payloadFormatIndicator, contentType })
    }

    async subscribe(opts: { topicFilter: string }): Promise<void> {
        const { topicFilter } = opts;

        const packetId = this.obtainPacketId();

        await this.sendMessage({ type: SUBSCRIBE, packetId, subscriptions: [ { topicFilter } ] })
    }

    async ping(): Promise<void> {
        await this.sendMessage({ type: PINGREQ });
    }

    //

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

    private async sendMessage(message: MqttMessage): Promise<void> {
        const { DEBUG } = Mqtt;
        if (DEBUG) console.log(`Sending ${computeControlPacketTypeName(message.type)}`);
        await this.connection.write(encodeMessage(message));
    }

    private processBytes(bytes: Uint8Array) {
        const { DEBUG } = Mqtt;
        if (DEBUG) console.log('processBytes', bytes.length + ' bytes');
        if (DEBUG) console.log(hex(bytes));

        const reader = new Reader(bytes, 0);
        while (reader.remaining() > 0) {
            const message = readMessage(reader);
            if (message.type === CONNACK) {
                if (this.onConnectionAcknowledged) this.onConnectionAcknowledged(message);
            } else if (message.type === DISCONNECT) {
                if (this.onDisconnected) this.onDisconnected(message);
            } else if (message.type === SUBACK) {
                this.releasePacketId(message.packetId);
                if (this.onSubscriptionAcknowledged) this.onSubscriptionAcknowledged(message);
                this.reschedulePing();
            } else if (message.type === PINGRESP) {
                // noop
            } else if (message.type === PUBLISH) {
                if (typeof message.packetId === 'number') console.log('SERVER PACKET ID', message.packetId);
                if (this.onPublish) this.onPublish(message);
            } else {
                throw new Error(`processPacket: Unsupported message type: ${message}`);
            }
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

}
