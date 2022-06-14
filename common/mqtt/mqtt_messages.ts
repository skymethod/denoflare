import { check, checkEqual } from '../check.ts';
import { decodeUtf8, decodeVariableByteInteger, Mqtt } from './mqtt.ts';

export function readMessage(reader: Reader): MqttMessage {
    // fixed header
    const first = reader.readUint8();
    const controlPacketType = first >> 4;
    const controlPacketFlags = first & 0x0f;
    const remainingLength = reader.readVariableByteInteger();
    const remainingBytes = reader.readBytes(remainingLength);

    const messageReader = new Reader(remainingBytes, 0);
    if (controlPacketType === CONNACK) return readConnack(messageReader, controlPacketFlags);
    if (controlPacketType === DISCONNECT) return readDisconnect(messageReader, controlPacketFlags, remainingLength);
    if (controlPacketType === SUBACK) return readSuback(messageReader, controlPacketFlags);
    if (controlPacketType === PINGRESP) return readPingresp(messageReader, controlPacketFlags);
    if (controlPacketType === PUBLISH) return readPublish(messageReader, controlPacketFlags);
    throw new Error(`readMessage: Unsupported controlPacketType: ${controlPacketType}`);
}

export type MqttMessage = ConnackMessage | DisconnectMessage | SubackMessage | PingrespMessage | PublishMessage;

//#region CONNACK

export const CONNACK = 2; type CONNACK = 2;

export interface ConnackMessage {
    readonly type: CONNACK;
    readonly reason?: Reason;
    readonly sessionPresent: boolean;
    readonly sessionExpiryInterval?: number;
    readonly maximumQos?: 0 | 1;
    readonly retainAvailable?: boolean;
    readonly maximumPacketSize?: number;
    readonly topicAliasMaximum?: number;
    readonly wildcardSubscriptionAvailable?: boolean;
    readonly subscriptionIdentifiersAvailable?: boolean;
    readonly sharedSubscriptionAvailable?: boolean;
    readonly serverKeepAlive?: number;
    readonly assignedClientIdentifier?: string;
}

export function readConnack(reader: Reader, controlPacketFlags: number): ConnackMessage {
    const { DEBUG } = Mqtt;
    checkEqual('controlPacketFlags', controlPacketFlags, 0);
    const connectAcknowledgeFlags = reader.readUint8();
    const sessionPresent = (connectAcknowledgeFlags & 0x1) === 0x1;
    const connectAcknowledgeFlagsReserved = connectAcknowledgeFlags & 0xfe;
    if (DEBUG) console.log({ sessionPresent, connectAcknowledgeFlagsReserved });
    checkEqual('connectAcknowledgeFlagsReserved', connectAcknowledgeFlagsReserved, 0);

    let rt: ConnackMessage = { type: CONNACK, sessionPresent }

    rt = { ...rt, reason: readReason(reader, CONNACK_REASONS) };

    readProperties(reader, propertyId => {
        if (propertyId === 17) {
            // 3.2.2.3.2 Session Expiry Interval
            const sessionExpiryInterval = reader.readUint32();
            if (DEBUG) console.log({ sessionExpiryInterval });
            rt = { ...rt, sessionExpiryInterval };
        } else if (propertyId === 36) {
            // 3.2.2.3.4 Maximum QoS
            const maximumQos = reader.readUint8();
            if (DEBUG) console.log({ maximumQos });
            check('maximumQos', maximumQos, maximumQos === 0 || maximumQos === 1);
            rt = { ...rt, maximumQos };
        } else if (propertyId === 37) {
            // 3.2.2.3.5 Retain Available
            rt = { ...rt, retainAvailable: readBooleanProperty('retainAvailable', reader) };
        } else if (propertyId === 39) {
            // 3.2.2.3.6 Maximum Packet Size
            const maximumPacketSize = reader.readUint32();
            if (DEBUG) console.log({ maximumPacketSize });
            rt = { ...rt, maximumPacketSize };
        } else if (propertyId === 34) {
            // 3.2.2.3.8 Topic Alias Maximum
            const topicAliasMaximum = reader.readUint16();
            if (DEBUG) console.log({ topicAliasMaximum });
            rt = { ...rt, topicAliasMaximum };
        } else if (propertyId === 40) {
            // 3.2.2.3.11 Wildcard Subscription Available
            rt = { ...rt, wildcardSubscriptionAvailable: readBooleanProperty('wildcardSubscriptionAvailable', reader) };
        } else if (propertyId === 41) {
            // 3.2.2.3.12 Subscription Identifiers Available
            rt = { ...rt, subscriptionIdentifiersAvailable: readBooleanProperty('subscriptionIdentifiersAvailable', reader) };
        } else if (propertyId === 42) {
            // 3.2.2.3.13 Shared Subscription Available
            rt = { ...rt, sharedSubscriptionAvailable: readBooleanProperty('sharedSubscriptionAvailable', reader) };
        } else if (propertyId === 19) {
            // 3.2.2.3.14 Server Keep Alive
            const serverKeepAlive = reader.readUint16();
            if (DEBUG) console.log({ serverKeepAlive });
            rt = { ...rt, serverKeepAlive };
        } else if (propertyId === 18) {
            // 3.2.2.3.7 Assigned Client Identifier
            const assignedClientIdentifier = reader.readUtf8();
            if (DEBUG) console.log({ assignedClientIdentifier });
            rt = { ...rt, assignedClientIdentifier };
        }  else {
            throw new Error(`Unsupported propertyId: ${propertyId}`);
        }
    });

    checkEqual('remaining', reader.remaining(), 0);

    return rt;
}

const CONNACK_REASONS: Record<number, [string, string]> = {
    // 3.2.2.2 Connect Reason Code
    0: [ 'Success', 'The Connection is accepted.' ],
    135: [ 'Not authorized', 'The Client is not authorized to connect.' ],
};

//#endregion

//#region DISCONNECT

export const DISCONNECT = 14; type DISCONNECT = 14;

export interface DisconnectMessage {
    readonly type: DISCONNECT;
    readonly reason?: Reason;
}

export function readDisconnect(reader: Reader, controlPacketFlags: number, remainingLength: number): DisconnectMessage {
    checkEqual('controlPacketFlags', controlPacketFlags, 0);

    let rt: DisconnectMessage = { type: DISCONNECT };

    if (remainingLength > 0) {
        rt = { ...rt, reason: readReason(reader, DISCONNECT_REASONS) };
    }

    if (remainingLength > 1) {
        readProperties(reader, propertyId => {
            throw new Error(`Unsupported propertyId: ${propertyId}`); 
        });
    }

    checkEqual('remaining', reader.remaining(), 0);

    return rt;
}

const DISCONNECT_REASONS: Record<number, [string, string]> = {
    // 3.14.2.1 Disconnect Reason Code
    0: [ 'Normal disconnection', 'Close the connection normally. Do not send the Will Message.' ],
    141: [ 'Keep Alive timeout', 'The Connection is closed because no packet has been received for 1.5 times the Keepalive time.' ],
};

//#endregion

//#region SUBACK

export const SUBACK = 9; type SUBACK = 9;

export interface SubackMessage {
    readonly type: SUBACK;
    readonly packetId: number;
    readonly reasons: Reason[];
}

export function readSuback(reader: Reader, controlPacketFlags: number): SubackMessage {
    checkEqual('controlPacketFlags', controlPacketFlags, 0);

    const packetId = reader.readUint16();
    const rt: SubackMessage = { type: SUBACK, packetId, reasons: [] };

    readProperties(reader, propertyId => {
        throw new Error(`Unsupported propertyId: ${propertyId}`); 
    });

    while (reader.remaining() > 0) {
        rt.reasons.push(readReason(reader, SUBACK_REASONS));
    }
    return rt;
}

const SUBACK_REASONS: Record<number, [string, string]> = {
    // 3.9.3 SUBACK Payload
    0: [ 'Granted QoS 0', 'The subscription is accepted and the maximum QoS sent will be QoS 0. This might be a lower QoS than was requested.' ],
};

//#endregion

//#region PINGRESP

export const PINGRESP = 13; type PINGRESP = 13;

export interface PingrespMessage {
    readonly type: PINGRESP;
}

export function readPingresp(reader: Reader, controlPacketFlags: number): PingrespMessage {
    checkEqual('controlPacketFlags', controlPacketFlags, 0);

    checkEqual('remaining', reader.remaining(), 0);

    return { type: PINGRESP };
}

//#endregion

//#region PUBLISH

export const PUBLISH = 3; type PUBLISH = 3;

export interface PublishMessage {
    readonly type: PUBLISH;
    readonly topic: string;
    readonly packetId?: number;
    readonly payloadFormatIndicator?: 0 | 1;
    readonly payload: Uint8Array;
    readonly contentType?: string;
}

export function readPublish(reader: Reader, controlPacketFlags: number): PublishMessage {
    const { DEBUG } = Mqtt;
    checkEqual('controlPacketFlags', controlPacketFlags, 0);
    
    const dup = (controlPacketFlags & 8) === 8;
    const qosLevel = (controlPacketFlags & 6) >> 1;
    const retain = (controlPacketFlags & 1) === 1;

    if (DEBUG) console.log({ dup, qosLevel, retain});
    if (qosLevel === 3) throw new Error(`Bad qosLevel: ${qosLevel}`);

    const topic = reader.readUtf8();

    let rt: PublishMessage = { type: PUBLISH, topic, payload: EMPTY_BYTES };

    if (qosLevel === 1 || qosLevel === 2) {
        rt = { ...rt, packetId: reader.readUint16() };
    }

    readProperties(reader, propertyId => {
        if (propertyId === 1) {
            // 3.3.2.3.2 Payload Format Indicator
            const payloadFormatIndicator = reader.readUint8();
            if (DEBUG) console.log({ payloadFormatIndicator });
            check('payloadFormatIndicator', payloadFormatIndicator, payloadFormatIndicator === 0 || payloadFormatIndicator === 1);
            rt = { ...rt, payloadFormatIndicator };
        } else if (propertyId === 3) {
            // 3.3.2.3.9 Content Type
            const contentType = reader.readUtf8();
            if (DEBUG) console.log({ contentType });
            rt = { ...rt, contentType };
        } else {
            throw new Error(`Unsupported propertyId: ${propertyId}`);
        }
    });

    rt = { ...rt, payload: reader.readBytes(reader.remaining()) };

    return rt;
}

//#endregion

//#region Reason

export type Reason = { code: number, name?: string, description?: string };

type ReasonTable = Record<number, [string, string]>;

function readReason(reader: Reader, table: ReasonTable): Reason {
    const { DEBUG } = Mqtt;
    const code = reader.readUint8();
    const [ name, description ] = table[code] ?? [ undefined, undefined ];
    const reason = { code, name, description };
    if (DEBUG) console.log({ reason });
    return reason;
}

//#endregion

const EMPTY_BYTES = new Uint8Array(0);

function readProperties(reader: Reader, handler: (propertyId: number) => void) {
    const { DEBUG } = Mqtt;
    const propertiesLength = reader.readVariableByteInteger();
    if (DEBUG) console.log({ propertiesLength });
    const propertiesEnd = reader.position + propertiesLength;
    while (reader.position < propertiesEnd) {
        const propertyId = reader.readVariableByteInteger();
        if (DEBUG) console.log({ propertyId });
        handler(propertyId);
    }
}

function readBooleanProperty(name: string, reader: Reader): boolean {
    const { DEBUG } = Mqtt;
    const value = reader.readUint8();
    if (DEBUG) console.log(Object.fromEntries([[ name, value ]]));
    check(name, value, value === 0 || value === 1);
    return value === 1;
}

//

export class Reader {
    private readonly bytes: Uint8Array;
    private readonly view: DataView;

    position: number;

    constructor(bytes: Uint8Array, offset: number) {
        this.bytes = bytes;
        this.view = new DataView(bytes.buffer, offset);
        this.position = offset;
    }

    remaining(): number {
        return this.view.byteLength - this.position;
    }

    readUint8(): number {
        return this.view.getUint8(this.position++);
    }

    readUint32(): number {
        const rt = this.view.getUint32(this.position);
        this.position += 4;
        return rt;
    }

    readUint16(): number {
        const rt = this.view.getUint16(this.position);
        this.position += 2;
        return rt;
    }

    readVariableByteInteger() {
        const { value, bytesUsed } = decodeVariableByteInteger(this.bytes, this.position);
        this.position += bytesUsed;
        return value;
    }

    readUtf8(): string {
        const { text, bytesUsed } = decodeUtf8(this.bytes, this.position);
        this.position += bytesUsed;
        return text;
    }

    readBytes(length: number): Uint8Array {
        const rt = this.bytes.slice(this.position, this.position + length);
        this.position += length;
        return rt;
    }

}
