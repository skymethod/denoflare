import { Bytes } from '../common/bytes.ts';
import { checkMatchesReturnMatcher } from '../common/check.ts';
import { Mqtt } from '../common/mqtt/mqtt.ts';
import { MqttClient } from '../common/mqtt/mqtt_client.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForPubsub, parsePubsubOptions } from './cli_pubsub.ts';

export const SUBSCRIBE_COMMAND = denoflareCliCommand(['pubsub', 'subscribe'], 'Subscribe to a Pub/Sub broker')
    .option('topic', 'required-string', 'Topic on which to subscribe')
    .include(commandOptionsForPubsub())
    .docsLink('/cli/pubsub#subscribe')
    ;

export async function subscribe(args: (string | number)[], options: Record<string, unknown>) {
    if (SUBSCRIBE_COMMAND.dumpHelp(args, options)) return;

    const { verbose, topic } = SUBSCRIBE_COMMAND.parse(args, options);

    if (verbose) {
        Mqtt.DEBUG = true;
    }

    const { endpoint, clientId, password } = parsePubsubOptions(options);

    const [ _, protocol, brokerName, namespaceName, portStr] = checkMatchesReturnMatcher('endpoint', endpoint, /^(mqtts|wss):\/\/(.*?)\.(.*?)\.cloudflarepubsub\.com:(\d+)$/);

    const hostname = `${brokerName}.${namespaceName}.cloudflarepubsub.com`;
    const port = parseInt(portStr);
    if (protocol !== 'mqtts' && protocol !== 'wss') throw new Error(`Unsupported protocol: ${protocol}`);

    const client = await MqttClient.create({ hostname, port, protocol });

    client.onPublish = opts => {
        const { topic, payloadFormatIndicator, payload } = opts;
        const display = payloadFormatIndicator === 1 ? new Bytes(payload).utf8() : `(${payload.length} bytes)${payload.length < 1000 ? ` ${new Bytes(payload).utf8()}` : ''}`;
        console.log(`[${topic}] ${display}`);
    };
    client.onConnectionAcknowledged = opts => {
        console.log('connection acknowledged', opts);
        if (opts.reason?.code === 0) {
            client.onSubscriptionAcknowledged = opts => {
                console.log('subscribed', opts);
            };
            console.log('subscribing');
            client.subscribe({ topic });
        } else {
            console.log('disconnecting');
            client.disconnect();
        }
    };

    await client.connect({ clientId, username: 'ignored', password });
    
    return client.readLoop.then(() => console.log('disconnected'));
}
