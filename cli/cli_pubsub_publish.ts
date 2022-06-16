import { Mqtt } from '../common/mqtt/mqtt.ts';
import { MqttClient } from '../common/mqtt/mod_deno.ts';
import { DISCONNECT } from '../common/mqtt/mqtt_messages.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForPubsub, parseCloudflareEndpoint, parsePubsubOptions } from './cli_pubsub.ts';

export const PUBLISH_COMMAND = denoflareCliCommand(['pubsub', 'publish'], 'Publish a message to a Pub/Sub broker')
    .option('text', 'string', 'Plaintext message payload')
    .option('file', 'string', 'Path to file with the message payload')
    .option('topic', 'required-string', 'Topic on which to publish the message')
    .option('n', 'integer', 'Times to repeat the message')
    .option('maxMessagesPerSecond', 'integer', 'Maximum rate of message to send per second')
    .include(commandOptionsForPubsub())
    .docsLink('/cli/pubsub#publish')
    ;

export async function publish(args: (string | number)[], options: Record<string, unknown>) {
    if (PUBLISH_COMMAND.dumpHelp(args, options)) return;

    const { verbose, text, file, topic, n, maxMessagesPerSecond = 10 } = PUBLISH_COMMAND.parse(args, options); // 10 = current beta limit: https://developers.cloudflare.com/pub-sub/platform/limits/

    if ((text ?? file) === undefined) throw new Error(`Specify a payload with --text or --file`);
    const basePayload = text ? text : await Deno.readFile(file!);

    if (verbose) {
        Mqtt.DEBUG = true;
    }

    const { endpoint, clientId, password, keepAlive, debugMessages } = await parsePubsubOptions(options);

    const { hostname, port, protocol } = parseCloudflareEndpoint(endpoint);
   
    const client = new MqttClient({ hostname, port, protocol, maxMessagesPerSecond }); 
    client.onMqttMessage = message => {
        if (debugMessages) console.log(JSON.stringify(message, undefined, 2));
        if (message.type === DISCONNECT) {
            console.log('disconnect', message.reason);
        }
    };

    console.log('connecting');
    await client.connect({ clientId, password, keepAlive });
    {
        const { clientId, keepAlive } = client;
        console.log('connected', { clientId, keepAlive });
    }

    for (let i = 0; i < (n ?? 1); i++) {
        console.log(`publishing${n ? ` ${i + 1} of ${n}` : ''}`);
        let payload = basePayload;
        if (n !== undefined && typeof payload === 'string' && payload.includes('$n')) {
            payload = payload.replace('$n', String(i + 1));
        }
        await client.publish({ topic, payload });
    }

    console.log('disconnecting');
    await client.disconnect();

    console.log('disconnected');
}
