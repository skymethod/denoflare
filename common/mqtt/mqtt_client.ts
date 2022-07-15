import { Bytes } from '../bytes.ts';
import { checkEqual } from '../check.ts';
import { hex, Mqtt } from './mqtt.ts';
import { MqttConnection } from './mqtt_connection.ts';
import { computeControlPacketTypeName, CONNACK, CONNECT, DISCONNECT, encodeMessage, MqttMessage, PINGREQ, PINGRESP, PUBLISH, Reader, readMessage, SUBACK, SUBSCRIBE } from './mqtt_messages.ts';
import { WebSocketConnection } from './web_socket_connection.ts';

/** 
 * Protocols supported by MqttClient.
 * 
 * - 'wss' (MQTT over WebSockets) should be supported in every environment.
 * - 'mqtts' needs TCP access, and is supported on Deno.
 * 
 * You can provide a custom implementation for a given protocol using `MqttClient.protocolHandlers`.
 */
export type Protocol = 'mqtts' | 'wss';

/**
 * Contract for providing a custom handler for 'wss' or 'mqtts'.
 * 
 * Register your custom implementation using `MqttClient.protocolHandlers`.
 */
export type ProtocolHandler = (opts: { hostname: string, port: number }) => Promise<MqttConnection>;

const DEFAULT_KEEP_ALIVE_SECONDS = 10;
const MAX_PACKET_IDS = 256 * 256;

/**
 * Lightweight MQTT v5 client.
 * 
 * Supports MQTT over WebSockets (wss) in the browser and Node, and also over TCP (mqtts) in Deno.
 * 
 * Only supports MQTTv5, and only the features currently implemented by [Cloudflare Pub/Sub](https://developers.cloudflare.com/pub-sub/).
 */
export class MqttClient {

    /**
     * Register a custom implementation for one of the supported protocols.
     * 
     * e.g. you could write your own 'mqtts' TCP implementation for Node and plug it in here.
     */
    static readonly protocolHandlers: Record<Protocol, ProtocolHandler> = {
        'mqtts': () => { throw new Error(`The 'mqtts' protocol is not supported in this environment`); },
        'wss': WebSocketConnection.create,
    };

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
    get clientId(): string | undefined { return this.clientIdInternal; }

    /** 
     * Returns the session keep-alive negotiated during initial connection.
     * 
     * MqttClient will automatically send underlying MQTT pings on this interval.
     */
    get keepAlive(): number | undefined { return this.keepAliveSeconds; }

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
    onReceive?: (opts: { topic: string, payload: string | Uint8Array, contentType?: string }) => void;

    /** @internal */ private readonly obtainedPacketIds: number[] = [];
    /** @internal */ private readonly pendingSubscribes: Record<number, Signal> = {};
    /** @internal */ private readonly savedBytes: number[] = [];
    /** @internal */ private readonly maxMessagesPerSecond?: number;

    /** @internal */ private connection?: MqttConnection;
    /** @internal */ private pingTimeout = 0;
    /** @internal */ private keepAliveSeconds = DEFAULT_KEEP_ALIVE_SECONDS;
    /** @internal */ private pendingConnect?: Signal;
    /** @internal */ private connectionCompletion?: Promise<void>;
    /** @internal */ private lastSentMessageTime = 0;
    /** @internal */ private receivedDisconnect = false;
    /** @internal */ private clientIdInternal: string | undefined;
    /** @internal */ private nextPacketId = 1;

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
    constructor(opts: { hostname: string, port: number, protocol: Protocol, maxMessagesPerSecond?: number }) {
        const { hostname, port, protocol, maxMessagesPerSecond } = opts;
        this.hostname = hostname;
        this.port = port;
        this.protocol = protocol;
        this.maxMessagesPerSecond = maxMessagesPerSecond;
    }

    /** 
     * When connected, resolves when the underlying connection is closed.
     * 
     * Useful to await when wanting to listen "forever" to a subscription without exiting your program.
     */
    completion(): Promise<void> {
        return this.connectionCompletion ?? Promise.resolve();
    }

    /** Returns whether or not this client is connected. */
    connected(): boolean {
        return this.connection !== undefined;
    }

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
    async connect(opts: { clientId?: string, username?: string, password: string, keepAlive?: number }): Promise<void> {
        const { DEBUG } = Mqtt;
        const { clientId = '', username, password, keepAlive = DEFAULT_KEEP_ALIVE_SECONDS } = opts;

        const { protocol, hostname, port } = this;
        if (!this.connection) {
            this.connection = await MqttClient.protocolHandlers[protocol]({ hostname, port });
            this.connection.onRead = bytes => {
                this.processBytes(bytes);
            }
            this.connectionCompletion = this.connection.completionPromise
                .then(() => { 
                    if (DEBUG) console.log('read loop done'); 
                    this.clearPing(); 
                    this.connection = undefined;

                    if (this.pendingConnect) {
                        this.pendingConnect.reject('Connect failed, connection closed');
                        this.pendingConnect = undefined;
                    }
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

    /** 
     * Disconnect from the server.
     * 
     * Resolves after the disconnect request is sent.
     */
    async disconnect(): Promise<void> {
        await this.sendMessage({ type: DISCONNECT, reason: { code: 0x00 /* normal disconnection */ } });
        this.connection = undefined;
    }

    /** 
     * Send a message for a given topic.
     * 
     * - `topic`: Required name of the topic on which the post the message.
     * - `payload`: Use a string to send a text payload, else a Uint8Array to send arbitrary bytes.
     * - `contentType`: Optional MIME type of the payload.
     */
    async publish(opts: { topic: string, payload: string | Uint8Array, contentType?: string }): Promise<void> {
        const { topic, payload: inputPayload, contentType } = opts;

        const payloadFormatIndicator = typeof inputPayload === 'string' ? 1 : 0;
        const payload = typeof inputPayload === 'string' ? Bytes.ofUtf8(inputPayload).array() : inputPayload;

        await this.sendMessage({ type: PUBLISH, dup: false, qosLevel: 0, retain: false, topic, payload, payloadFormatIndicator, contentType });
        // we only support qos for now, so no need to wait for ack
    }

    /** 
     * Subscribe to receive messages for a given topic.
     * 
     * Resolves when the subscription is acknowledged by the server, else rejects.
     * 
     * Once subscribed, messages will arrive via the `onReceive` handler.
     * 
     * - `topicFilter`: Topic name to listen to.
     */
    async subscribe(opts: { topicFilter: string }): Promise<void> {
        const { topicFilter } = opts;

        const packetId = this.obtainPacketId();

        const signal = new Signal();
        this.pendingSubscribes[packetId] = signal;

        await this.sendMessage({ type: SUBSCRIBE, packetId, subscriptions: [ { topicFilter } ] }); 

        return signal.promise; // wait for SUBACK
    }

    //

    /** @internal */ 
    private async ping(): Promise<void> {
        await this.sendMessage({ type: PINGREQ });
    }

    /** @internal */ 
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

    /** @internal */ 
    private releasePacketId(packetId: number) {
        const { DEBUG } = Mqtt;
        const { obtainedPacketIds } = this;
        if (packetId < 1 || packetId >= MAX_PACKET_IDS) throw new Error(`releasePacketId: Bad packetId: ${packetId}`);
        const i = obtainedPacketIds.indexOf(packetId);
        if (i < 0) throw new Error(`releasePacketId: Unobtained packetId: ${packetId}`);
        obtainedPacketIds.splice(i, 1);
        if (DEBUG) console.log(`Released packetId: ${packetId}`);
    }

    /** @internal */ 
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

    /** @internal */ 
    private clearPing() {
        clearTimeout(this.pingTimeout);
    }

    /** @internal */ 
    private reschedulePing() {
        this.clearPing();
        this.pingTimeout = setTimeout(async () => {
            await this.ping();
            this.reschedulePing();
        }, this.keepAliveSeconds * 1000);
    }

    /** @internal */ 
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
