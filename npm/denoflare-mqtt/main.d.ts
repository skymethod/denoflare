/**
 * Protocols supported by MqttClient.
 *
 * - 'wss' (MQTT over WebSockets) should be supported in every environment.
 * - 'mqtts' needs TCP access, and is supported on Deno.
 *
 * You can provide a custom implementation for a given protocol using `MqttClient.protocolHandlers`.
 */
export declare type Protocol = 'mqtts' | 'wss';
/**
 * Contract for providing a custom handler for 'wss' or 'mqtts'.
 *
 * Register your custom implementation using `MqttClient.protocolHandlers`.
 */
export declare type ProtocolHandler = (opts: {
    hostname: string;
    port: number;
}) => Promise<MqttConnection>;
/**
 * Lightweight MQTT v5 client.
 *
 * Supports MQTT over WebSockets (wss) in the browser and Node, and also over TCP (mqtts) in Deno.
 *
 * Only supports MQTTv5, and only the features currently implemented by [Cloudflare Pub/Sub](https://developers.cloudflare.com/pub-sub/).
 */
export declare class MqttClient {
    /**
     * Register a custom implementation for one of the supported protocols.
     *
     * e.g. you could write your own 'mqtts' TCP implementation for Node and plug it in here.
     */
    static readonly protocolHandlers: Record<Protocol, ProtocolHandler>;
    /** MQTT endpoint hostname. */
    readonly hostname: string;
    /** MQTT endpoint port. */
    readonly port: number;
    /** MQTT endpoint protocol. */
    readonly protocol: Protocol;
    /**
     * Returns the session client id negotiated during initial connection.
     *
     * This will be the one provided explicitiy in `connect`, unless the server assigns one when it acknowledges the connection.
    */
    get clientId(): string | undefined;
    /**
     * Returns the session keep-alive negotiated during initial connection.
     *
     * MqttClient will automatically send underlying MQTT pings on this interval.
     */
    get keepAlive(): number | undefined;
    /**
     * Called when any underlying MQTT protocol message is received.
     *
     * Useful for debugging, or responding to DISCONNECT.
     */
    onMqttMessage?: (message: MqttMessage) => void;
    /**
     * Called when a message is received for one of your subscriptions made with `subscribe`.
     *
     * The payload will be a string if the sender indicated a UTF-8 format, otherwise a Uint8Array.
    */
    onReceive?: (opts: {
        topic: string;
        payload: string | Uint8Array;
        contentType?: string;
    }) => void;
    /**
     * Creates a new MqttClient.
     *
     * - `hostname`: MQTT endpoint hostname.  e.g. my-broker.my-namespace.cloudflarepubsub.com
     * - `port`: MQTT endpoint port.  e.g. 8884 for web sockets
     * - `protocol`: MQTT endpoint protocol.  e.g. 'wss' for web sockets
     * - `maxMessagesPerSecond`: Optional, but can be used to rate limit outgoing messages if needed by the endpoint.
     *
     * Once created, call `connect` to connect.
     */
    constructor(opts: {
        hostname: string;
        port: number;
        protocol: Protocol;
        maxMessagesPerSecond?: number;
    });
    /**
     * When connected, resolves when the underlying connection is closed.
     *
     * Useful to await when wanting to listen "forever" to a subscription without exiting your program.
     */
    completion(): Promise<void>;
    /** Returns whether or not this client is connected. */
    connected(): boolean;
    /**
     * Connect and authenticate with the server.
     *
     * Resolves when the server acknowledges a successful connection, otherwise rejects.
     *
     * - `clientId`: Optional if the server assigns a client id (e.g. based on the password).
     * - `username`: Optional for some servers.
     * - `password`: The password to use when initiating the connection.
     * - `keepAlive`: Desired keep-alive, in seconds.  Note the server can override this, the resolved value is available in `keepAlive` once connected.
     */
    connect(opts: {
        clientId?: string;
        username?: string;
        password: string;
        keepAlive?: number;
    }): Promise<void>;
    /**
     * Disconnect from the server.
     *
     * Resolves after the disconnect request is sent.
     */
    disconnect(): Promise<void>;
    /**
     * Send a message for a given topic.
     *
     * - `topic`: Required name of the topic on which the post the message.
     * - `payload`: Use a string to send a text payload, else a Uint8Array to send arbitrary bytes.
     * - `contentType`: Optional MIME type of the payload.
     */
    publish(opts: {
        topic: string;
        payload: string | Uint8Array;
        contentType?: string;
    }): Promise<void>;
    /**
     * Subscribe to receive messages for a given topic.
     *
     * Resolves when the subscription is acknowledged by the server, else rejects.
     *
     * Once subscribed, messages will arrive via the `onReceive` handler.
     *
     * - `topicFilter`: Topic name to listen to.
     */
    subscribe(opts: {
        topicFilter: string;
    }): Promise<void>;
}


/** Supported MQTT protocol messages as strongly-typed, parsed objects. */
export declare type MqttMessage = ConnectMessage | ConnackMessage | PublishMessage | SubscribeMessage | SubackMessage | PingreqMessage | PingrespMessage | DisconnectMessage;
/** Supported MQTT control packet types. */
export declare type ControlPacketType = CONNECT | CONNACK | PUBLISH | SUBSCRIBE | SUBACK | PINGREQ | PINGRESP | DISCONNECT;
/** Returns the control packet type name for a given type. */
export declare function computeControlPacketTypeName(type: ControlPacketType): string;
/** MQTT CONNECT (constant) */ export declare const CONNECT = 1; /** MQTT CONNECT (type) */
export declare type CONNECT = 1;
/** Parsed MQTT CONNECT message. */
export interface ConnectMessage {
    readonly type: CONNECT;
    readonly keepAlive: number;
    readonly clientId: string;
    readonly username?: string;
    readonly password: string;
}
/** MQTT CONNACK (constant) */ export declare const CONNACK = 2; /** MQTT CONNACK (type) */
export declare type CONNACK = 2;
/** Parsed MQTT CONNACK message. */
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
/** MQTT PUBLISH (constant) */ export declare const PUBLISH = 3; /** MQTT PUBLISH (type) */
export declare type PUBLISH = 3;
/** Parsed MQTT PUBLISH message. */
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
/** MQTT SUBSCRIBE (constant) */ export declare const SUBSCRIBE = 8; /** MQTT SUBSCRIBE (type) */
export declare type SUBSCRIBE = 8;
/** Parsed MQTT SUBSCRIBE message. */
export interface SubscribeMessage {
    readonly type: SUBSCRIBE;
    readonly packetId: number;
    readonly subscriptions: Subscription[];
}
/** Single subscription information. */
export interface Subscription {
    readonly topicFilter: string;
}
/** MQTT SUBACK (constant) */ export declare const SUBACK = 9; /** MQTT SUBACK (type) */
export declare type SUBACK = 9;
/** Parsed MQTT SUBACK message. */
export interface SubackMessage {
    readonly type: SUBACK;
    readonly packetId: number;
    readonly reasons: Reason[];
}
/** MQTT PINGREQ (constant) */ export declare const PINGREQ = 12; /** MQTT PINGREQ (type) */
export declare type PINGREQ = 12;
/** Parsed MQTT PINGREQ message. */
export interface PingreqMessage {
    readonly type: PINGREQ;
}
/** MQTT PINGRESP (constant) */ export declare const PINGRESP = 13; /** MQTT PINGRESP (type) */
export declare type PINGRESP = 13;
/** Parsed MQTT PINGRESP message. */
export interface PingrespMessage {
    readonly type: PINGRESP;
}
/** MQTT DISCONNECT (constant) */ export declare const DISCONNECT = 14; /** MQTT DISCONNECT (type) */
export declare type DISCONNECT = 14;
/** Parsed MQTT DISCONNECT message. */
export interface DisconnectMessage {
    readonly type: DISCONNECT;
    readonly reason?: Reason;
}
/** Parsed reason code with name and description, if known. */
export declare type Reason = {
    code: number;
    name?: string;
    description?: string;
};


/**
 * Low-level abstraction for a single bi-directional MQTT connection to a server.
 *
 * Can be used to provide custom protocol handler implementations for the higher-level MqttClient.
*/
export interface MqttConnection {
    /** Writes bytes to the outgoing connection to the server. */
    write(bytes: Uint8Array): Promise<number>;
    /** Called when incoming bytes are received from the server. */
    onRead: (bytes: Uint8Array) => void;
    /** Resolves when the connection is closed. */
    readonly completionPromise: Promise<void>;
    /** Closes the connection. */
    close(): void;
}


/** Static constants for debugging MqttClient. */
export declare class Mqtt {
    /** Enable debug-level logging throughout MqttClient and its dependencies. */
    static DEBUG: boolean;
}
