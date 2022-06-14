import { Bytes } from '../bytes.ts';
import { check, checkEqual } from '../check.ts';

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
    static DEBUG = false;

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
        const { DEBUG } = MqttClient;
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
            ...encodeLength(0), // properties = none
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
            ...encodeLength(properties.length),
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
            ...encodeLength(0), // properties = none
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
        const { DEBUG } = MqttClient;
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
        const { DEBUG } = MqttClient;
        const { packetIds } = this;
        if (packetId < 1 || packetId >= packetIds.length) throw new Error(`releasePacketId: Bad packetId: ${packetId}`);
        if (!packetIds[packetId]) throw new Error(`releasePacketId: Unobtained packetId: ${packetId}`);
        if (DEBUG) console.log(`Released packetId: ${packetId}`);
        packetIds[packetId] = false;
    }

    private async sendPacket(controlPacketType: number, controlPacketName: string, opts: { controlPacketFlags?: number, variableHeader?: number[], payload?: number[] | Uint8Array }) {
        const { controlPacketFlags = 0, variableHeader = [], payload = [] } = opts;
        const { DEBUG } = MqttClient;
        const remainingLength = variableHeader.length + payload.length;
        if (DEBUG) console.log({ remainingLength, variableHeaderLength: variableHeader.length, payloadLength: payload.length });
        const fixedHeader = [ (controlPacketType << 4) | controlPacketFlags, ...encodeLength(remainingLength) ];
        
        if (DEBUG) console.log(`fixedHeader: ${new Bytes(new Uint8Array(fixedHeader)).hex()}`);
        if (DEBUG) console.log(`variableHeader: ${new Bytes(new Uint8Array(variableHeader)).hex()}`);
        if (DEBUG) console.log(`payloadhex: ${new Bytes(new Uint8Array(payload)).hex()}`);
        const packet = new Uint8Array([ ...fixedHeader, ...variableHeader, ...payload ]);
        if (DEBUG) console.log(`Sending ${controlPacketName}`);
        if (DEBUG) console.log(packet);
        await this.connection.write(packet);
    }

    private processPacket(packet: Uint8Array) {
        const { DEBUG } = MqttClient;
        if (DEBUG) console.log('processPacket', packet.length + ' bytes');
        if (DEBUG) console.log(new Bytes(packet).hex());

        let i = 0;
        const first = packet[i]; i++;
        const controlPacketType = first >> 4;
        const reserved = first & 0x0f;
        if (DEBUG) console.log({ controlPacketType, reserved });
        
        if (controlPacketType === 2) {
            const opts = parseConnack(reserved, packet, i);
            if (this.onConnectionAcknowledged) this.onConnectionAcknowledged(opts);
        } else if (controlPacketType === 14) {
            const opts = parseDisconnect(reserved, packet, i);
            if (this.onDisconnected) this.onDisconnected(opts);
        } else if (controlPacketType === 9) {
            const { opts, packetId } = parseSuback(reserved, packet, i);
            this.releasePacketId(packetId);
            if (this.onSubscriptionAcknowledged) this.onSubscriptionAcknowledged(opts);
            this.reschedulePing();
        } else if (controlPacketType === 13) {
            parsePingresp(reserved, packet, i);
        } else if (controlPacketType === 3) {
            const { opts, packetId } = parsePublish(reserved, packet, i);
            if (typeof packetId === 'number') console.log('SERVER PACKET ID', packetId);
            if (this.onPublish) this.onPublish(opts);
        } else {
            throw new Error(`Unsupported controlPacketType: ${controlPacketType}`);
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

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encodeUtf8(value: string): number[] {
    const arr = encoder.encode(value);
    // https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html#_UTF-8_Encoded_String
    if (arr.length > 65535) throw new Error('the maximum size of a UTF-8 Encoded String is 65,535 bytes.');
    const lengthBytes = [ arr.length >> 8, arr.length & 0xff ]; // always exactly 2 bytes
    return [ ...lengthBytes, ...arr ];
}

function decodeUtf8(buffer: Uint8Array, startIndex: number): { text: string, bytesUsed: number } {
    const length = (buffer[startIndex] << 8) + buffer[startIndex + 1];
    const bytes = buffer.slice(startIndex + 2, startIndex + 2 + length);
    const text = decoder.decode(bytes);

    return { text, bytesUsed: length + 2 };
}

function encodeLength(length: number): number[] {
    const rt = [];
    do {
        let encodedByte = length % 128;
        length = Math.floor(length / 128);
        if (length > 0) {
            encodedByte = encodedByte | 128;
        }
        rt.push(encodedByte);
    } while (length > 0);
    return rt;
}

function decodeLength(buffer: Uint8Array, startIndex: number) {
    let i = startIndex;
    let encodedByte = 0;
    let length = 0;
    let multiplier = 1;
    do {
        encodedByte = buffer[i++];
        length += (encodedByte & 127) * multiplier;
        if (multiplier > 128 * 128 * 128) throw Error('malformed length');
        multiplier *= 128;
    } while ((encodedByte & 128) != 0);
    return { length, bytesUsed: i - startIndex };
}

function encodeUint16(value: number): Uint8Array {
    const buffer = new ArrayBuffer(2);
    const view = new DataView(buffer);
    view.setUint16(0, value);
    return new Uint8Array(buffer);
}

function parseConnack(reserved: number, packet: Uint8Array, i: number): ConnectionAcknowledgedOpts {
    const { DEBUG } = MqttClient;
    checkEqual('reserved', reserved, 0);
    const { length: remainingLength, bytesUsed } = decodeLength(packet, 1); i += bytesUsed;
    if (DEBUG) console.log({ remainingLength });
    checkEqual('remainingLength', packet.length - i, remainingLength);
    const connectAcknowledgeFlags = packet[i]; i++;
    const sessionPresent = (connectAcknowledgeFlags & 0x1) === 0x1;
    if (DEBUG) console.log({ sessionPresent });
    checkEqual('connectAcknowledgeFlags.reserved', connectAcknowledgeFlags & 0xfe, 0);
    const connectReasonCode = packet[i]; i++;
    const reason: Reason = (code => {
        const reasons: Record<number, [string, string]> = {
            // 3.2.2.2 Connect Reason Code
            0: [ 'Success', 'The Connection is accepted.' ],
            135: [ 'Not authorized', 'The Client is not authorized to connect.' ],
        }
        const [ name, description ] = reasons[code] ?? [ undefined, undefined ];
        return { code, name, description };
    })(connectReasonCode);
    if (DEBUG) console.log({ reason })

    // properties
    const propertiesLength = packet[i]; i++;
    if (DEBUG) console.log({ propertiesLength });
    const propertiesEnd = i + propertiesLength;
    let sessionExpiryInterval: number | undefined;
    let maximumQos: number | undefined;
    let retainAvailable: number | undefined;
    let maximumPacketSize: number | undefined;
    let topicAliasMaximum: number | undefined;
    let wildcardSubscriptionAvailable: number | undefined;
    let subscriptionIdentifiersAvailable: number | undefined;
    let sharedSubscriptionAvailable: number | undefined;
    let serverKeepAlive: number | undefined;
    let assignedClientIdentifier: string | undefined;
    while (i < propertiesEnd) {
        const propertyId = packet[i]; i++;
        if (DEBUG) console.log({ propertyId });
        if (propertyId === 17) {
            // 3.2.2.3.2 Session Expiry Interval
            const view = new DataView(packet.slice(i, i + 4).buffer); i += 4;
            sessionExpiryInterval = view.getInt32(0);
            if (DEBUG) console.log({ sessionExpiryInterval });
        } else if (propertyId === 36) {
            // 3.2.2.3.4 Maximum QoS
            maximumQos = packet[i]; i++;
            if (DEBUG) console.log({ maximumQos });
            check('maximumQos', maximumQos, maximumQos === 0 || maximumQos === 1);
        } else if (propertyId === 37) {
            // 3.2.2.3.5 Retain Available
            retainAvailable = packet[i]; i++;
            if (DEBUG) console.log({ retainAvailable });
            check('retainAvailable', retainAvailable, retainAvailable === 0 || retainAvailable === 1);
        } else if (propertyId === 39) {
            // 3.2.2.3.6 Maximum Packet Size
            const view = new DataView(packet.slice(i, i + 4).buffer); i += 4;
            maximumPacketSize = view.getInt32(0);
            if (DEBUG) console.log({ maximumPacketSize });
        } else if (propertyId === 34) {
            // 3.2.2.3.8 Topic Alias Maximum
            const view = new DataView(packet.slice(i, i + 2).buffer); i += 2;
            topicAliasMaximum = view.getInt16(0);
            if (DEBUG) console.log({ topicAliasMaximum });
        } else if (propertyId === 40) {
            // 3.2.2.3.11 Wildcard Subscription Available
            wildcardSubscriptionAvailable = packet[i]; i++;
            if (DEBUG) console.log({ wildcardSubscriptionAvailable });
            check('wildcardSubscriptionAvailable', wildcardSubscriptionAvailable, wildcardSubscriptionAvailable === 0 || wildcardSubscriptionAvailable === 1);
        } else if (propertyId === 41) {
            // 3.2.2.3.12 Subscription Identifiers Available
            subscriptionIdentifiersAvailable = packet[i]; i++;
            if (DEBUG) console.log({ subscriptionIdentifiersAvailable });
            check('subscriptionIdentifiersAvailable', subscriptionIdentifiersAvailable, subscriptionIdentifiersAvailable === 0 || subscriptionIdentifiersAvailable === 1);
        } else if (propertyId === 42) {
            // 3.2.2.3.13 Shared Subscription Available
            sharedSubscriptionAvailable = packet[i]; i++;
            if (DEBUG) console.log({ sharedSubscriptionAvailable });
            check('sharedSubscriptionAvailable', sharedSubscriptionAvailable, sharedSubscriptionAvailable === 0 || sharedSubscriptionAvailable === 1);
        } else if (propertyId === 19) {
            // 3.2.2.3.14 Server Keep Alive
            const view = new DataView(packet.slice(i, i + 2).buffer); i += 2;
            serverKeepAlive = view.getInt16(0);
            if (DEBUG) console.log({ serverKeepAlive });
        } else if (propertyId === 18) {
            // 3.2.2.3.7 Assigned Client Identifier
            const { text, bytesUsed } = decodeUtf8(packet, i); i += bytesUsed;
            assignedClientIdentifier = text;
            if (DEBUG) console.log({ assignedClientIdentifier });
        }  else {
            throw new Error(`Unsupported propertyId: ${propertyId}`);
        }
    }

    return {
        reason,
        sessionPresent,
        sessionExpiryInterval, 
        maximumQos: maximumQos === 0 ? 0 : maximumQos === 1 ? 1 : undefined, 
        retainAvailable: retainAvailable === 1,
        maximumPacketSize,
        topicAliasMaximum,
        wildcardSubscriptionAvailable: wildcardSubscriptionAvailable === 1,
        subscriptionIdentifiersAvailable: subscriptionIdentifiersAvailable === 1,
        sharedSubscriptionAvailable: sharedSubscriptionAvailable === 1,
        serverKeepAlive,
        assignedClientIdentifier,
    };
}

function parseDisconnect(reserved: number, packet: Uint8Array, i: number): DisconnectedOpts {
    const { DEBUG } = MqttClient;
    // DISCONNECT

    checkEqual('reserved', reserved, 0);
    const { length: remainingLength, bytesUsed } = decodeLength(packet, 1); i += bytesUsed;
    if (DEBUG) console.log({ remainingLength });
    checkEqual('remainingLength', packet.length - i, remainingLength);
    let reasonCode = 0;
    if (remainingLength > 0) {
        reasonCode = packet[i]; i++;
    }

    const reason: Reason = (code => {
        const reasons: Record<number, [string, string]> = {
            // 3.14.2.1 Disconnect Reason Code
            0: [ 'Normal disconnection', 'Close the connection normally. Do not send the Will Message.' ],
            141: [ 'Keep Alive timeout', 'The Connection is closed because no packet has been received for 1.5 times the Keepalive time.' ],
        }
        const [ name, description ] = reasons[code] ?? [ undefined, undefined ];
        return { code, name, description };
    })(reasonCode);
    if (DEBUG) console.log({ reason });

    if (remainingLength > 1) {
        // properties
        const propertiesLength = packet[i]; i++;
        if (DEBUG) console.log({ propertiesLength });
        const propertiesEnd = i + propertiesLength;
        while (i < propertiesEnd) {
            const propertyId = packet[i]; i++;
            if (DEBUG) console.log({ propertyId });
            throw new Error(`Unsupported propertyId: ${propertyId}`);
        }
    }

    return { 
        reason,
    };
}

function parseSuback(reserved: number, packet: Uint8Array, i: number): { opts: SubscriptionAcknowledgedOpts, packetId: number } {
    const { DEBUG } = MqttClient;
    // SUBACK

    checkEqual('reserved', reserved, 0);
    const { length: remainingLength, bytesUsed } = decodeLength(packet, 1); i += bytesUsed;
    if (DEBUG) console.log({ remainingLength });
    checkEqual('remainingLength', packet.length - i, remainingLength);
    const packetId = new DataView(packet.slice(i, i + 2).buffer).getInt16(0);
    if (DEBUG) console.log({ packetId });

    const propertiesLength = packet[i]; i++;
    if (DEBUG) console.log({ propertiesLength });
    const propertiesEnd = i + propertiesLength;
    while (i < propertiesEnd) {
        const propertyId = packet[i]; i++;
        if (DEBUG) console.log({ propertyId });
        throw new Error(`Unsupported propertyId: ${propertyId}`);
    }

    return { 
        opts: {},
        packetId,
    };
}

function parsePingresp(reserved: number, packet: Uint8Array, i: number) {
    const { DEBUG } = MqttClient;
    // PINGRESP

    checkEqual('reserved', reserved, 0);
    const { length: remainingLength, bytesUsed } = decodeLength(packet, 1); i += bytesUsed;
    if (DEBUG) console.log({ remainingLength });
    checkEqual('remainingLength', packet.length - i, remainingLength);
    checkEqual('remainingLength', remainingLength, 0);
}

function parsePublish(flags: number, packet: Uint8Array, i: number): { opts: PublishOpts, packetId?: number } {
    const { DEBUG } = MqttClient;
    // PUBLISH

    const dup = (flags & 8) === 8;
    const qosLevel = (flags & 6) >> 1;
    const retain = (flags & 1) === 1;

    if (DEBUG) console.log({ dup, qosLevel, retain});
    if (qosLevel === 3) throw new Error(`Bad qosLevel: ${qosLevel}`);
    {
        const { length: remainingLength, bytesUsed } = decodeLength(packet, 1); i += bytesUsed;
        if (DEBUG) console.log({ remainingLength });
        checkEqual('remainingLength', packet.length - i, remainingLength);
    }

    const { text: topic, bytesUsed } = decodeUtf8(packet, i); i += bytesUsed;
    if (DEBUG) console.log({ topic});
    let packetId: number | undefined;
    if (qosLevel === 1 || qosLevel === 2) {
        packetId = new DataView(packet.slice(i, i + 2).buffer).getInt16(0);
        if (DEBUG) console.log({ packetId });
    }

    const propertiesLength = packet[i]; i++;
    if (DEBUG) console.log({ propertiesLength });
    const propertiesEnd = i + propertiesLength;
    let payloadFormatIndicator: number | undefined;
    let contentType: string | undefined;
    while (i < propertiesEnd) {
        const propertyId = packet[i]; i++;
        if (DEBUG) console.log({ propertyId });
        if (propertyId === 1) {
            // 3.3.2.3.2 Payload Format Indicator
            payloadFormatIndicator = packet[i]; i++;
            if (DEBUG) console.log({ payloadFormatIndicator });
            check('payloadFormatIndicator', payloadFormatIndicator, payloadFormatIndicator === 0 || payloadFormatIndicator === 1);
        } else if (propertyId === 3) {
            // 3.3.2.3.9 Content Type
            const { text, bytesUsed } = decodeUtf8(packet, i); i += bytesUsed;
            contentType = text;
            if (DEBUG) console.log({ contentType });
        } else {
            throw new Error(`Unsupported propertyId: ${propertyId}`);
        }
    }

    const payload = packet.slice(i);

    return { 
        opts: { topic, payloadFormatIndicator, payload, contentType },
        packetId,
    };
}
