import { check, checkEqual } from '../check.ts';
import { decodeUtf8, decodeVariableByteInteger, encodeUtf8, encodeVariableByteInteger, hex, Mqtt } from './mqtt.ts';

// https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html

export type MqttMessage = ConnectMessage | ConnackMessage | PublishMessage | SubscribeMessage | SubackMessage | PingreqMessage | PingrespMessage | DisconnectMessage;
export type ControlPacketType = CONNECT | CONNACK | PUBLISH | SUBSCRIBE | SUBACK | PINGREQ | PINGRESP | DISCONNECT;

/** @internal */
export function readMessage(reader: Reader): MqttMessage | { needsMoreBytes: number } {
    const { DEBUG } = Mqtt;

    // fixed header
    if (reader.remaining() < 2) return { needsMoreBytes: 2 };
    const first = reader.readUint8();
    const controlPacketType = first >> 4;
    const controlPacketFlags = first & 0x0f;
    const remainingLength = reader.readVariableByteInteger();
    if (reader.remaining() < remainingLength) return { needsMoreBytes: remainingLength };
    const remainingBytes = reader.readBytes(remainingLength);
    if (DEBUG) console.log(`readMessage: ${hex([first, ...encodeVariableByteInteger(remainingLength), ...remainingBytes])}`);

    const messageReader = new Reader(remainingBytes, 0);
    if (controlPacketType === CONNACK) return readConnack(messageReader, controlPacketFlags);
    if (controlPacketType === PUBLISH) return readPublish(messageReader, controlPacketFlags);
    if (controlPacketType === SUBACK) return readSuback(messageReader, controlPacketFlags);
    if (controlPacketType === PINGRESP) return readPingresp(messageReader, controlPacketFlags);
    if (controlPacketType === DISCONNECT) return readDisconnect(messageReader, controlPacketFlags, remainingLength);
    throw new Error(`readMessage: Unsupported controlPacketType: ${controlPacketType}`);
}

/** @internal */
export function encodeMessage(message: MqttMessage): Uint8Array {
    if (message.type === CONNECT) return encodeConnect(message);
    if (message.type === PUBLISH) return encodePublish(message);
    if (message.type === SUBSCRIBE) return encodeSubscribe(message);
    if (message.type === PINGREQ) return encodePingreq(message);
    if (message.type === DISCONNECT) return encodeDisconnect(message);
    throw new Error(`encodeMessage: Unsupported controlPacketType: ${message.type}`);
}

/** Returns the control packet type name. */
export function computeControlPacketTypeName(type: ControlPacketType): string {
    if (type === CONNECT) return 'CONNECT';
    if (type === CONNACK) return 'CONNACK';
    if (type === PUBLISH) return 'PUBLISH';
    if (type === SUBSCRIBE) return 'SUBSCRIBE';
    if (type === SUBACK) return 'SUBACK';
    if (type === PINGREQ) return 'PINGREQ';
    if (type === PINGRESP) return 'PINGRESP';
    if (type === DISCONNECT) return 'DISCONNECT';
    throw new Error(`computeControlPacketTypeName: Unsupported controlPacketType: ${type}`);
}

//#region CONNECT

export const CONNECT = 1; export type CONNECT = 1;

export interface ConnectMessage {
    readonly type: CONNECT;
    readonly keepAlive: number;
    readonly clientId: string;
    readonly username?: string;
    readonly password: string;
}

/** @internal */
export function encodeConnect(message: ConnectMessage): Uint8Array {
    const { type, keepAlive, clientId, username, password } = message;

    const connectFlags = ((username ? 1 : 0) << 7) | (1 << 6);
    const variableHeader = [ 
        ...encodeUtf8('MQTT'), // protocol name
        0x05, // protocol version
        connectFlags,
        ...encodeUint16(keepAlive),
        ...encodeVariableByteInteger(0), // properties = none
    ];

    const payload = [
        ...encodeUtf8(clientId),
        ...(username ? encodeUtf8(username) : []),
        ...encodeUtf8(password),
    ];

    return encodePacket(type, { variableHeader, payload });
}

//#endregion

//#region CONNACK

export const CONNACK = 2; export type CONNACK = 2;

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

/** @internal */
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

    if (reader.remaining() > 0) {
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
    }

    checkEqual('remaining', reader.remaining(), 0);

    return rt;
}

const CONNACK_REASONS: ReasonTable = {
    // 3.2.2.2 Connect Reason Code
    0: [ 'Success', 'The Connection is accepted.' ],
    128: [ 'Unspecified error', 'The Server does not wish to reveal the reason for the failure, or none of the other Reason Codes apply.' ],
    129: [ 'Malformed Packet', 'Data within the CONNECT packet could not be correctly parsed.' ],
    130: [ 'Protocol Error', 'Data in the CONNECT packet does not conform to this specification.' ],
    131: [ 'Implementation specific error', 'The CONNECT is valid but is not accepted by this Server.' ],
    132: [ 'Unsupported Protocol Version', 'The Server does not support the version of the MQTT protocol requested by the Client.' ],
    133: [ 'Client Identifier not valid', 'The Client Identifier is a valid string but is not allowed by the Server.' ],
    134: [ 'Bad User Name or Password', 'The Server does not accept the User Name or Password specified by the Client' ],
    135: [ 'Not authorized', 'The Client is not authorized to connect.' ],
    136: [ 'Server unavailable', 'The MQTT Server is not available.' ],
    137: [ 'Server busy', 'The Server is busy. Try again later.' ],
    138: [ 'Banned', 'This Client has been banned by administrative action. Contact the server administrator.' ],
    140: [ 'Bad authentication method', 'The authentication method is not supported or does not match the authentication method currently in use.' ],
    144: [ 'Topic Name invalid', 'The Will Topic Name is not malformed, but is not accepted by this Server.' ],
    149: [ 'Packet too large', 'The CONNECT packet exceeded the maximum permissible size.' ],
    151: [ 'Quota exceeded', 'An implementation or administrative imposed limit has been exceeded.' ],
    153: [ 'Payload format invalid', 'The Will Payload does not match the specified Payload Format Indicator.' ],
    154: [ 'Retain not supported', 'The Server does not support retained messages, and Will Retain was set to 1.' ],
    155: [ 'QoS not supported', 'The Server does not support the QoS set in Will QoS.' ],
    156: [ 'Use another server', 'The Client should temporarily use another server.' ],
    157: [ 'Server moved', 'The Client should permanently use another server.' ],
    159: [ 'Connection rate exceeded', 'The connection rate limit has been exceeded.' ],
};

//#endregion

//#region PUBLISH

export const PUBLISH = 3; export type PUBLISH = 3;

export interface PublishMessage {
    readonly type: PUBLISH;
    readonly dup: boolean;
    readonly qosLevel: 0 | 1 | 2;
    readonly retain: boolean;
    readonly topic: string;
    readonly packetId?: number;
    readonly payloadFormatIndicator?: 0 | 1;
    readonly payload: Uint8Array;
    readonly contentType?: string;
}

/** @internal */
export function readPublish(reader: Reader, controlPacketFlags: number): PublishMessage {
    const { DEBUG } = Mqtt;
    checkEqual('controlPacketFlags', controlPacketFlags, 0);
    
    const dup = (controlPacketFlags & 8) === 8;
    const qosLevel = (controlPacketFlags & 6) >> 1;
    const retain = (controlPacketFlags & 1) === 1;

    if (DEBUG) console.log({ dup, qosLevel, retain});
    if (qosLevel !== 0 && qosLevel !== 1 && qosLevel !== 2) throw new Error(`Bad qosLevel: ${qosLevel}`);

    const topic = reader.readUtf8();

    let rt: PublishMessage = { type: PUBLISH, dup, qosLevel, retain, topic, payload: EMPTY_BYTES };

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

/** @internal */
export function encodePublish(message: PublishMessage): Uint8Array {
    const { payloadFormatIndicator, topic, payload, type, dup, qosLevel, retain, packetId, contentType } = message;

    if (qosLevel === 1 || qosLevel === 2) {
        if (packetId === undefined) throw new Error(`Missing packetId: required with qosLevel ${qosLevel}`);
    } else if (qosLevel === 0) {
        if (packetId !== undefined) throw new Error(`Bad packetId: not applicable with qosLevel 0`);
    } else {
        throw new Error(`Bad qosLevel: ${qosLevel}`);
    }
    
    const controlPacketFlags = (dup ? (1 << 3) : 0) | (qosLevel % 4 << 1) | (retain ? 1 : 0);

    const properties = [
        ...(payloadFormatIndicator === undefined ? [] : [ 1, payloadFormatIndicator ]), // 3.3.2.3.2 Payload Format Indicator
        ...(contentType === undefined ? [] : [ 3, ...encodeUtf8(contentType) ]), // 3.3.2.3.9 Content Type
    ];
    
    const variableHeader = [ 
        ...encodeUtf8(topic),
        ...(packetId === undefined ? [] : encodeUint16(packetId)),
        ...encodeVariableByteInteger(properties.length),
        ...properties,
    ];

    return encodePacket(type, { controlPacketFlags, variableHeader, payload });
}

//#endregion

//#region SUBSCRIBE

export const SUBSCRIBE = 8; export type SUBSCRIBE = 8;

export interface SubscribeMessage {
    readonly type: SUBSCRIBE;
    readonly packetId: number;
    readonly subscriptions: Subscription[];
}

export interface Subscription {
    readonly topicFilter: string;
}

/** @internal */
export function encodeSubscribe(message: SubscribeMessage): Uint8Array {
    const { type, packetId, subscriptions } = message;

    const controlPacketFlags = 2; // 0,0,1,0 constants

    const variableHeader = [ 
        ...encodeUint16(packetId),
        ...encodeVariableByteInteger(0), // properties = none
    ];

    const payload = subscriptions.flatMap(v => [ ...encodeUtf8(v.topicFilter), 0 /* qos 0, no no-local, no retain as published, retain handling = Send retained messages at the time of the subscribe */ ]);

    return encodePacket(type, { controlPacketFlags, variableHeader, payload });
}

//#endregion

//#region SUBACK

export const SUBACK = 9; export type SUBACK = 9;

export interface SubackMessage {
    readonly type: SUBACK;
    readonly packetId: number;
    readonly reasons: Reason[];
}

/** @internal */
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

const SUBACK_REASONS: ReasonTable = {
    // 3.9.3 SUBACK Payload
    0: [ 'Granted QoS 0', 'The subscription is accepted and the maximum QoS sent will be QoS 0. This might be a lower QoS than was requested.' ],
    1: [ 'Granted QoS 1', 'The subscription is accepted and the maximum QoS sent will be QoS 1. This might be a lower QoS than was requested.' ],
    2: [ 'Granted QoS 2', 'The subscription is accepted and any received QoS will be sent to this subscription.' ],
    128: [ 'Unspecified error', 'The subscription is not accepted and the Server either does not wish to reveal the reason or none of the other Reason Codes apply.' ],
    131: [ 'Implementation specific error', 'The SUBSCRIBE is valid but the Server does not accept it.' ],
    135: [ 'Not authorized', 'The Client is not authorized to make this subscription.' ],
    143: [ 'Topic Filter invalid', 'The Topic Filter is correctly formed but is not allowed for this Client.' ],
    145: [ 'Packet Identifier in use', 'The specified Packet Identifier is already in use.' ],
    151: [ 'Quota exceeded', 'An implementation or administrative imposed limit has been exceeded.' ],
    158: [ 'Shared Subscriptions not supported', 'The Server does not support Shared Subscriptions for this Client.' ],
    161: [ 'Subscription Identifiers not supported', 'The Server does not support Subscription Identifiers; the subscription is not accepted.' ],
    162: [ 'Wildcard Subscriptions not supported', 'The Server does not support Wildcard Subscriptions; the subscription is not accepted.' ],
};

//#endregion

//#region PINGREQ

export const PINGREQ = 12; export type PINGREQ = 12;

export interface PingreqMessage {
    readonly type: PINGREQ;
}

/** @internal */
export function encodePingreq(message: PingreqMessage): Uint8Array {
    const { type } = message;

    return encodePacket(type);
}

//#endregion

//#region PINGRESP

export const PINGRESP = 13; export type PINGRESP = 13;

export interface PingrespMessage {
    readonly type: PINGRESP;
}

/** @internal */
export function readPingresp(reader: Reader, controlPacketFlags: number): PingrespMessage {
    checkEqual('controlPacketFlags', controlPacketFlags, 0);

    checkEqual('remaining', reader.remaining(), 0);

    return { type: PINGRESP };
}

//#endregion

//#region DISCONNECT

export const DISCONNECT = 14; export type DISCONNECT = 14;

export interface DisconnectMessage {
    readonly type: DISCONNECT;
    readonly reason?: Reason;
}

/** @internal */
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

const DISCONNECT_REASONS: ReasonTable = {
    // 3.14.2.1 Disconnect Reason Code
    0: [ 'Normal disconnection', 'Close the connection normally. Do not send the Will Message.' ],
    4: [ 'Disconnect with Will Message', 'The Client wishes to disconnect but requires that the Server also publishes its Will Message.' ],
    128: [ 'Unspecified error', 'The Connection is closed but the sender either does not wish to reveal the reason, or none of the other Reason Codes apply.' ],
    129: [ 'Malformed Packet', 'The received packet does not conform to this specification.' ],
    130: [ 'Protocol Error', 'An unexpected or out of order packet was received.' ],
    131: [ 'Implementation specific error', 'The packet received is valid but cannot be processed by this implementation.' ],
    135: [ 'Not authorized', 'The request is not authorized.' ],
    137: [ 'Server busy', 'The Server is busy and cannot continue processing requests from this Client.' ],
    139: [ 'Server shutting down', 'The Server is shutting down.' ],
    141: [ 'Keep Alive timeout', 'The Connection is closed because no packet has been received for 1.5 times the Keepalive time.' ],
    142: [ 'Session taken over', 'Another Connection using the same ClientID has connected causing this Connection to be closed.' ],
    143: [ 'Topic Filter invalid', 'The Topic Filter is correctly formed, but is not accepted by this Sever.' ],
    144: [ 'Topic Name invalid', 'The Topic Name is correctly formed, but is not accepted by this Client or Server.' ],
    147: [ 'Receive Maximum exceeded', 'The Client or Server has received more than Receive Maximum publication for which it has not sent PUBACK or PUBCOMP.' ],
    148: [ 'Topic Alias invalid', 'The Client or Server has received a PUBLISH packet containing a Topic Alias which is greater than the Maximum Topic Alias it sent in the CONNECT or CONNACK packet.' ],
    149: [ 'Packet too large', 'The packet size is greater than Maximum Packet Size for this Client or Server.' ],
    150: [ 'Message rate too high', 'The received data rate is too high.' ],
    151: [ 'Quota exceeded', 'An implementation or administrative imposed limit has been exceeded.' ],
    152: [ 'Administrative action', 'The Connection is closed due to an administrative action.' ],
    153: [ 'Payload format invalid', 'The payload format does not match the one specified by the Payload Format Indicator.' ],
    154: [ 'Retain not supported', 'The Server has does not support retained messages.' ],
    155: [ 'QoS not supported', 'The Client specified a QoS greater than the QoS specified in a Maximum QoS in the CONNACK.' ],
    156: [ 'Use another server', 'The Client should temporarily change its Server.' ],
    157: [ 'Server moved', 'The Server is moved and the Client should permanently change its server location.' ],
    158: [ 'Shared Subscriptions not supported', 'The Server does not support Shared Subscriptions.' ],
    159: [ 'Connection rate exceeded', 'This connection is closed because the connection rate is too high.' ],
    160: [ 'Maximum connect time', 'The maximum connection time authorized for this connection has been exceeded.' ],
    161: [ 'Subscription Identifiers not supported', 'The Server does not support Subscription Identifiers; the subscription is not accepted.' ],
    162: [ 'Wildcard Subscriptions not supported', 'The Server does not support Wildcard Subscriptions; the subscription is not accepted.' ],
};

/** @internal */
export function encodeDisconnect(message: DisconnectMessage): Uint8Array {
    const { type, reason } = message;

    const reasonCode = reason?.code ?? 0 /* normal disconnection */;
    const variableHeader = [ 
        reasonCode,
    ];

    return encodePacket(type, { variableHeader });
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

function encodeUint16(value: number): Uint8Array {
    const buffer = new ArrayBuffer(2);
    const view = new DataView(buffer);
    view.setUint16(0, value);
    return new Uint8Array(buffer);
}

function encodePacket(controlPacketType: ControlPacketType, opts: { controlPacketFlags?: number, variableHeader?: number[], payload?: number[] | Uint8Array } = {}): Uint8Array {
    const { DEBUG } = Mqtt;
    const { controlPacketFlags = 0, variableHeader = [], payload = [] } = opts;
    const remainingLength = variableHeader.length + payload.length;

    if (DEBUG) console.log({ remainingLength, variableHeaderLength: variableHeader.length, payloadLength: payload.length });
    const fixedHeader = [ (controlPacketType << 4) | controlPacketFlags, ...encodeVariableByteInteger(remainingLength) ];
    if (DEBUG) console.log(`fixedHeader: ${hex(fixedHeader)}`);
    if (DEBUG) console.log(`variableHeader: ${hex(variableHeader)}`);
    if (DEBUG) console.log(`payload: ${hex(payload)}`);
    const packet = new Uint8Array([ ...fixedHeader, ...variableHeader, ...payload ]);
    if (DEBUG) console.log(`packet: ${hex(packet)}`);
    return packet;
}

//

/** @internal */
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
        return this.bytes.length - this.position;
    }

    readUint8(): number {
        this.ensureCapacity(1);
        return this.view.getUint8(this.position++);
    }

    readUint32(): number {
        this.ensureCapacity(4);
        const rt = this.view.getUint32(this.position);
        this.position += 4;
        return rt;
    }

    readUint16(): number {
        this.ensureCapacity(2);
        const rt = this.view.getUint16(this.position);
        this.position += 2;
        return rt;
    }

    readVariableByteInteger() {
        this.ensureCapacity(1); // hmm
        const { value, bytesUsed } = decodeVariableByteInteger(this.bytes, this.position);
        this.position += bytesUsed;
        return value;
    }

    readUtf8(): string {
        this.ensureCapacity(2); // hmm
        const { text, bytesUsed } = decodeUtf8(this.bytes, this.position);
        this.position += bytesUsed;
        return text;
    }

    readBytes(length: number): Uint8Array {
        this.ensureCapacity(length);
        const rt = this.bytes.slice(this.position, this.position + length);
        this.position += length;
        return rt;
    }

    //

    private ensureCapacity(length: number) {
        const remaining = this.remaining();
        if (remaining < length) throw new Error(`reader needs ${length} bytes, has ${remaining} remaining`);
    }

}
