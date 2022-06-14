import { Bytes } from '../bytes.ts';
import { checkEqual } from '../check.ts';
import { encodeUtf8, encodeVariableByteInteger, Mqtt } from './mqtt.ts';
import { CONNACK, DISCONNECT, PINGRESP, PUBLISH, Reader, readMessage, SUBACK } from './mqtt_messages.ts';

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

    private readonly connection: Deno.TlsConn;

    private constructor(hostname: string, port: number, connection: Deno.TlsConn) {
        this.hostname = hostname;
        this.port = port;
        this.connection = connection;
        this.readLoop = this.initReadLoop();
    }

    private initReadLoop(): Promise<void> {
        const { DEBUG } = Mqtt;
        return (async () => {
            while (true) {
                const buffer = new Uint8Array(8 * 1024);
                if (DEBUG) console.log('before read');
                const result = await this.connection.read(buffer);
                if (result === null) {
                    if (DEBUG) console.log('EOF');
                    return;
                }
                if (DEBUG) console.log(`Received ${result} bytes`);
                try {
                    this.processPacket(buffer.slice(0, result));
                } catch (e) {
                    console.log(`error processing packet: ${e.stack || e}`);
                }
            }
        })()
        // deno-lint-ignore no-explicit-any
        .then(() => { if (DEBUG) console.log('read loop done'); this.clearPing(); }, (e: any) => { console.log(`unhandled read loop error: ${e.stack || e}`); this.clearPing(); });
    }

    static async create(opts: { hostname: string, port: number }): Promise<MqttClient> {
        const { hostname, port } = opts;
        const connection = await Deno.connectTls({ hostname, port });
        return new MqttClient(hostname, port, connection);
    }

    async connect(opts: { clientId: string, username: string, password: string, keepAlive?: number }): Promise<void> {
        const { clientId, username, password, keepAlive = 10 } = opts;

        const variableHeader = [ 
            ...encodeUtf8('MQTT'), // protocol name
            0x05, // protocol version
            0xC0, // connect flags: username, password
            ...encodeUint16(keepAlive),
            ...encodeVariableByteInteger(0), // properties = none
        ];
    
        const payload = [
            ...encodeUtf8(clientId),
            ...encodeUtf8(username),
            ...encodeUtf8(password),
        ];
        
        await this.sendPacket(1, 'CONNECT', { variableHeader, payload });
    }

    async disconnect(): Promise<void> {
        const variableHeader = [ 
            0x00, // normal disconnection
        ];

        await this.sendPacket(14, 'DISCONNECT', { variableHeader });
    }

    async publish(opts: { topic: string, payload: string | Uint8Array }): Promise<void> {
        const { topic, payload: inputPayload } = opts;

        const properties = [ 1, typeof inputPayload === 'string' ? 1 : 0 ] // 3.3.2.3.2 Payload Format Indicator
        const variableHeader = [ 
            ...encodeUtf8(topic),
            ...encodeVariableByteInteger(properties.length),
            ...properties,
        ];
    
        const payload = typeof inputPayload === 'string' ? Bytes.ofUtf8(inputPayload).array() : inputPayload;
        
        await this.sendPacket(3, 'PUBLISH', { controlPacketFlags: 0 /* no dup, qos=0, no retain */, variableHeader, payload });
    }

    async subscribe(opts: { topic: string }): Promise<void> {
        const { topic } = opts;

        const packetId = this.obtainPacketId();
        const variableHeader = [ 
            ...encodeUint16(packetId),
            ...encodeVariableByteInteger(0), // properties = none
        ];
    
        const payload = [
            ...encodeUtf8(topic),
            0, // qos 0, no no-local, no retain as published, retain handling = Send retained messages at the time of the subscribe
        ]
        
        await this.sendPacket(8, 'SUBSCRIBE', { controlPacketFlags: 2 /* 0,0,1,0 constants */, variableHeader, payload });
    }

    async ping(): Promise<void> {
        await this.sendPacket(12, 'PINGREQ', {  });
    }

    //

    private readonly packetIds = new Array<boolean>(256 * 256);

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

    private async sendPacket(controlPacketType: number, controlPacketName: string, opts: { controlPacketFlags?: number, variableHeader?: number[], payload?: number[] | Uint8Array }) {
        const { controlPacketFlags = 0, variableHeader = [], payload = [] } = opts;
        const { DEBUG } = Mqtt;
        const remainingLength = variableHeader.length + payload.length;
        if (DEBUG) console.log({ remainingLength, variableHeaderLength: variableHeader.length, payloadLength: payload.length });
        const fixedHeader = [ (controlPacketType << 4) | controlPacketFlags, ...encodeVariableByteInteger(remainingLength) ];
        
        if (DEBUG) console.log(`fixedHeader: ${new Bytes(new Uint8Array(fixedHeader)).hex()}`);
        if (DEBUG) console.log(`variableHeader: ${new Bytes(new Uint8Array(variableHeader)).hex()}`);
        if (DEBUG) console.log(`payloadhex: ${new Bytes(new Uint8Array(payload)).hex()}`);
        const packet = new Uint8Array([ ...fixedHeader, ...variableHeader, ...payload ]);
        if (DEBUG) console.log(`Sending ${controlPacketName}`);
        if (DEBUG) console.log(packet);
        await this.connection.write(packet);
    }

    private processPacket(packet: Uint8Array) {
        const { DEBUG } = Mqtt;
        if (DEBUG) console.log('processPacket', packet.length + ' bytes');
        if (DEBUG) console.log(new Bytes(packet).hex());

        const reader = new Reader(packet, 0);
        const message = readMessage(reader);
        checkEqual('reader.remaining', reader.remaining(), 0);
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

    private pingTimeout = 0;

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

//

function encodeUint16(value: number): Uint8Array {
    const buffer = new ArrayBuffer(2);
    const view = new DataView(buffer);
    view.setUint16(0, value);
    return new Uint8Array(buffer);
}
