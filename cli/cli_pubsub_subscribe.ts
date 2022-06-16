import { Bytes } from '../common/bytes.ts';
import { Mqtt } from '../common/mqtt/mqtt.ts';
import { MqttClient } from '../common/mqtt/mod_deno.ts';
import { DISCONNECT } from '../common/mqtt/mqtt_messages.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForPubsub, parseCloudflareEndpoint, parsePubsubOptions } from './cli_pubsub.ts';

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

    const { endpoint, clientId, password, keepAlive, debugMessages } = await parsePubsubOptions(options);

    const { hostname, port, protocol } = parseCloudflareEndpoint(endpoint);

    const client = new MqttClient({ hostname, port, protocol });
    client.onMqttMessage = message => {
        if (debugMessages) console.log(JSON.stringify(message, undefined, 2));
        if (message.type === DISCONNECT) {
            console.log('disconnect', message.reason);
        }
    };

    client.onReceive = opts => {
        const { topic, payload, contentType } = opts;
        const display = typeof payload === 'string' ? payload : `(${payload.length} bytes)${payload.length < 1000 ? ` ${new Bytes(payload).utf8()}` : ''}`;
        console.log(`[topic: ${topic}]${contentType ? ` [content-type: ${contentType}]` : ''} ${display}`);
    };

    console.log('connecting');
    await client.connect({ clientId, password, keepAlive });
    {
        const { clientId, keepAlive } = client;
        console.log('connected', { clientId, keepAlive });
    }

    console.log('subscribing');
    await client.subscribe({ topicFilter: topic });

    console.log('listening');
    await client.completion();
    console.log('completed');
}
