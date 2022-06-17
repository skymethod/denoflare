export declare type Protocol = 'mqtts' | 'wss';
export declare type ProtocolHandler = (opts: {
    hostname: string;
    port: number;
}) => Promise<MqttConnection>;
/**
 * Lightweight MQTT v5 client.
 *
 * Supports MQTT over WebSockets (wss) in the browser and Node, and also over TCP (mqtts) in Deno.
 */
export declare class MqttClient {
    static readonly protocolHandlers: Record<Protocol, ProtocolHandler>;
    /** MQTT endpoint hostname. */
    readonly hostname: string;
    readonly port: number;
    readonly protocol: Protocol;
    get clientId(): string | undefined;
    get keepAlive(): number | undefined;
    onMqttMessage?: (message: MqttMessage) => void;
    onReceive?: (opts: {
        topic: string;
        payload: string | Uint8Array;
        contentType?: string;
    }) => void;
    constructor(opts: {
        hostname: string;
        port: number;
        protocol: Protocol;
        maxMessagesPerSecond?: number;
    });
    completion(): Promise<void>;
    connected(): boolean;
    connect(opts: {
        clientId?: string;
        username?: string;
        password: string;
        keepAlive?: number;
    }): Promise<void>;
    disconnect(): Promise<void>;
    publish(opts: {
        topic: string;
        payload: string | Uint8Array;
        contentType?: string;
    }): Promise<void>;
    subscribe(opts: {
        topicFilter: string;
    }): Promise<void>;
}


export declare type MqttMessage = ConnectMessage | ConnackMessage | PublishMessage | SubscribeMessage | SubackMessage | PingreqMessage | PingrespMessage | DisconnectMessage;
export declare type ControlPacketType = CONNECT | CONNACK | PUBLISH | SUBSCRIBE | SUBACK | PINGREQ | PINGRESP | DISCONNECT;
/** Returns the control packet type name. */
export declare function computeControlPacketTypeName(type: ControlPacketType): string;
export declare const CONNECT = 1;
export declare type CONNECT = 1;
export interface ConnectMessage {
    readonly type: CONNECT;
    readonly keepAlive: number;
    readonly clientId: string;
    readonly username?: string;
    readonly password: string;
}
export declare const CONNACK = 2;
export declare type CONNACK = 2;
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
export declare const PUBLISH = 3;
export declare type PUBLISH = 3;
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
export declare const SUBSCRIBE = 8;
export declare type SUBSCRIBE = 8;
export interface SubscribeMessage {
    readonly type: SUBSCRIBE;
    readonly packetId: number;
    readonly subscriptions: Subscription[];
}
export interface Subscription {
    readonly topicFilter: string;
}
export declare const SUBACK = 9;
export declare type SUBACK = 9;
export interface SubackMessage {
    readonly type: SUBACK;
    readonly packetId: number;
    readonly reasons: Reason[];
}
export declare const PINGREQ = 12;
export declare type PINGREQ = 12;
export interface PingreqMessage {
    readonly type: PINGREQ;
}
export declare const PINGRESP = 13;
export declare type PINGRESP = 13;
export interface PingrespMessage {
    readonly type: PINGRESP;
}
export declare const DISCONNECT = 14;
export declare type DISCONNECT = 14;
export interface DisconnectMessage {
    readonly type: DISCONNECT;
    readonly reason?: Reason;
}
export declare type Reason = {
    code: number;
    name?: string;
    description?: string;
};


export interface MqttConnection {
    write(bytes: Uint8Array): Promise<number>;
    onRead: (bytes: Uint8Array) => void;
    readonly completionPromise: Promise<void>;
    close(): void;
}


export declare class Mqtt {
    static DEBUG: boolean;
}
