import { Bytes } from '../common/bytes.ts';
import { check, checkEqual, checkMatchesReturnMatcher } from '../common/check.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForPubsub, parsePubsubOptions } from './cli_pubsub.ts';

export const PUBLISH_COMMAND = denoflareCliCommand(['pubsub', 'publish'], 'Publish a message to a Pub/Sub broker')
    .option('text', 'string', 'Plaintext message payload')
    .option('topic', 'required-string', 'Topic on which to publish the message')
    .include(commandOptionsForPubsub())
    .docsLink('/cli/pubsub#publish')
    ;

export async function publish(args: (string | number)[], options: Record<string, unknown>) {
    if (PUBLISH_COMMAND.dumpHelp(args, options)) return;

    const { verbose, text, topic } = PUBLISH_COMMAND.parse(args, options);

    if (typeof text !== 'string') throw new Error(`Specify a payload with --text`);

    let DEBUG = false;
    if (verbose) {
        DEBUG = true;
    }

    const { endpoint, clientId, password } = parsePubsubOptions(options);

    const [ _, brokerName, namespaceName, portStr] = checkMatchesReturnMatcher('endpoint', endpoint, /^mqtts:\/\/(.*?)\.(.*?)\.cloudflarepubsub\.com:(\d+)$/);

    const hostname = `${brokerName}.${namespaceName}.cloudflarepubsub.com`;
    const port = parseInt(portStr);
    const conn = await Deno.connectTls({ hostname, port });

    const sendPacket = async (controlPacketType: number, controlPacketName: string, opts: { controlPacketFlags?: number, variableHeader: number[], payload?: number[] | Uint8Array }) => {
        const { controlPacketFlags = 0, variableHeader, payload = [] } = opts;

        const remainingLength = variableHeader.length + payload.length;
        console.log({ remainingLength, variableHeaderLength: variableHeader.length, payloadLength: payload.length });
        const fixedHeader = [ (controlPacketType << 4) | controlPacketFlags, ...encodeLength(remainingLength) ];
         
        if (DEBUG) console.log(`fixedHeader: ${new Bytes(new Uint8Array(fixedHeader)).hex()}`);
        if (DEBUG) console.log(`variableHeader: ${new Bytes(new Uint8Array(variableHeader)).hex()}`);
        if (DEBUG) console.log(`payloadhex: ${new Bytes(new Uint8Array(payload)).hex()}`);
        const connect = new Uint8Array([ ...fixedHeader, ...variableHeader, ...payload ]);
        console.log(`Sending ${controlPacketName}`);
        if (DEBUG) console.log(connect);
        await conn.write(connect);
    };

    const sendConnect = async () => {
        const userName = "user"; // ignored

        const variableHeader = [ 
            ...encodeUtf8('MQTT'), // protocol name
            0x05, // protocol version
            0xC0, // connect flags: username, password
            0x00, 0x0A, // keep alive = 10 seconds
            ...encodeLength(0), // properties = none
        ];
    
        const payload = [
            ...encodeUtf8(clientId),
            ...encodeUtf8(userName),
            ...encodeUtf8(password),
        ];
        
        await sendPacket(1, 'CONNECT', { variableHeader, payload });
    };

    const sendPublish = async () => {
        const properties = [ 0x01, 1 ] // Payload is UTF-8 Encoded Character Data
        const variableHeader = [ 
            ...encodeUtf8(topic),
            ...encodeLength(properties.length),
            ...properties,
        ];
    
        const payload = Bytes.ofUtf8(text).array();
        
        await sendPacket(3, 'PUBLISH', { controlPacketFlags: 0 /* !dup, qos=0, !retain*/, variableHeader, payload });

        sendDisconnect();
    };

    const sendDisconnect = async () => {
        const variableHeader = [ 
            0x00, // normal disconnection
        ];

        await sendPacket(14, 'DISCONNECT', { variableHeader });
    };

    const processPacket = (packet: Uint8Array) => {
        console.log('processPacket', packet.length + ' bytes');
        if (DEBUG) console.log(new Bytes(packet).hex());

        let i = 0;
        const first = packet[i]; i++;
        const controlPacketType = first >> 4;
        const reserved = first & 0x0f;
        console.log({ controlPacketType, reserved });
       
        if (controlPacketType === 2) {
            // CONNACK
            checkEqual('reserved', reserved, 0);
            const { length: remainingLength, bytesUsed } = decodeLength(packet, 1); i += bytesUsed;
            console.log({ remainingLength });
            checkEqual('remainingLength', packet.length - i, remainingLength);
            const connectAcknowledgeFlags = packet[i]; i++;
            const sessionPresent = (connectAcknowledgeFlags & 0x1) === 0x1;
            console.log({ sessionPresent });
            checkEqual('connectAcknowledgeFlags.reserved', connectAcknowledgeFlags & 0xfe, 0);
            const connectReasonCode = packet[i]; i++;
            
            console.log({ connectReasonCode });

            // properties
            const propertiesLength = packet[i]; i++;
            console.log({ propertiesLength });
            const propertiesEnd = i + propertiesLength;
            while (i < propertiesEnd) {
                const propertyId = packet[i]; i++;
                console.log({ propertyId });
                if (propertyId === 17) {
                    // 3.2.2.3.2 Session Expiry Interval
                    const view = new DataView(packet.slice(i, i + 4).buffer); i += 4;
                    const sessionExpiryInterval = view.getInt32(0);
                    console.log({ sessionExpiryInterval });
                } else if (propertyId === 36) {
                    // 3.2.2.3.4 Maximum QoS
                    const maximumQos = packet[i]; i++;
                    console.log({ maximumQos });
                    check('maximumQos', maximumQos, maximumQos === 0 || maximumQos === 1);
                } else if (propertyId === 37) {
                    // 3.2.2.3.5 Retain Available
                    const retainAvailable = packet[i]; i++;
                    console.log({ retainAvailable });
                    check('retainAvailable', retainAvailable, retainAvailable === 0 || retainAvailable === 1);
                } else if (propertyId === 39) {
                    // 3.2.2.3.6 Maximum Packet Size
                    const view = new DataView(packet.slice(i, i + 4).buffer); i += 4;
                    const maximumPacketSize = view.getInt32(0);
                    console.log({ maximumPacketSize });
                } else if (propertyId === 34) {
                    // 3.2.2.3.8 Topic Alias Maximum
                    const view = new DataView(packet.slice(i, i + 2).buffer); i += 2;
                    const topicAliasMaximum = view.getInt16(0);
                    console.log({ topicAliasMaximum });
                } else if (propertyId === 40) {
                    // 3.2.2.3.11 Wildcard Subscription Available
                    const wildcardSubscriptionAvailable = packet[i]; i++;
                    console.log({ wildcardSubscriptionAvailable });
                    check('wildcardSubscriptionAvailable', wildcardSubscriptionAvailable, wildcardSubscriptionAvailable === 0 || wildcardSubscriptionAvailable === 1);
                } else if (propertyId === 41) {
                    // 3.2.2.3.12 Subscription Identifiers Available
                    const subscriptionIdentifiersAvailable = packet[i]; i++;
                    console.log({ subscriptionIdentifiersAvailable });
                    check('subscriptionIdentifiersAvailable', subscriptionIdentifiersAvailable, subscriptionIdentifiersAvailable === 0 || subscriptionIdentifiersAvailable === 1);
                } else if (propertyId === 42) {
                    // 3.2.2.3.13 Shared Subscription Available
                    const sharedSubscriptionAvailable = packet[i]; i++;
                    console.log({ sharedSubscriptionAvailable });
                    check('sharedSubscriptionAvailable', sharedSubscriptionAvailable, sharedSubscriptionAvailable === 0 || sharedSubscriptionAvailable === 1);
                } else if (propertyId === 19) {
                    // 3.2.2.3.14 Server Keep Alive
                    const view = new DataView(packet.slice(i, i + 2).buffer); i += 2;
                    const serverKeepAlive = view.getInt16(0);
                    console.log({ serverKeepAlive });
                } else {
                    throw new Error(`Unsupported propertyId: ${propertyId}`);
                }
            }

            sendPublish();
        } else if (controlPacketType === 14) {
            // DISCONNECT

            checkEqual('reserved', reserved, 0);
            const { length: remainingLength, bytesUsed } = decodeLength(packet, 1); i += bytesUsed;
            console.log({ remainingLength });
            checkEqual('remainingLength', packet.length - i, remainingLength);
            if (remainingLength > 0) {
                const disconnectReasonCode = packet[i]; i++;
                const disconnectReasons: Record<number, unknown> = {
                    141: { name: 'Keep Alive timeout', description: 'The Connection is closed because no packet has been received for 1.5 times the Keepalive time.' },
                }
                console.log({ disconnectReasonCode, reason: disconnectReasons[disconnectReasonCode] });
            }

            if (remainingLength > 1) {
                // properties
                const propertiesLength = packet[i]; i++;
                console.log({ propertiesLength });
                const propertiesEnd = i + propertiesLength;
                while (i < propertiesEnd) {
                    const propertyId = packet[i]; i++;
                    console.log({ propertyId });
                    throw new Error(`Unsupported propertyId: ${propertyId}`);
                }
            }
        } else {
            throw new Error(`Unsupported controlPacketType: ${controlPacketType}`);
        }

    };

    const rt = (async () => {
        while (true) {
            const buffer = new Uint8Array(8 * 1024);
            console.log('before read');
            const result = await conn.read(buffer);
            if (result === null) {
                console.log('EOF');
                return;
            }
            console.log(`Received ${result} bytes`);
            try {
                processPacket(buffer.slice(0, result));
            } catch (e) {
                console.log(`error processing packet: ${e.stack || e}`);
            }
        }
    })()
    // deno-lint-ignore no-explicit-any
    .then(() => console.log('read loop done'), (e: any) => console.log(`unhandled read loop error: ${e.stack || e}`));

    sendConnect();
    return rt;
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

const encoder = new TextEncoder();

function encodeUtf8(value: string): number[] {
    const arr = encoder.encode(value);
    // https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html#_UTF-8_Encoded_String
    if (arr.length > 65535) throw new Error('the maximum size of a UTF-8 Encoded String is 65,535 bytes.');
    const lengthBytes = [ arr.length >> 8, arr.length & 0xff ]; // always exactly 2 bytes
    return [ ...lengthBytes, ...arr ];
}
