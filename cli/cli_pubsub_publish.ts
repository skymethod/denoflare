import { checkMatchesReturnMatcher } from '../common/check.ts';
import { Mqtt } from '../common/mqtt/mqtt.ts';
import { MqttClient } from '../common/mqtt/mqtt_client.ts';
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

    if (verbose) {
        Mqtt.DEBUG = true;
    }

    const { endpoint, clientId, password } = parsePubsubOptions(options);

    const [ _, protocol, brokerName, namespaceName, portStr] = checkMatchesReturnMatcher('endpoint', endpoint, /^(mqtts|wss):\/\/(.*?)\.(.*?)\.cloudflarepubsub\.com:(\d+)$/);

    const hostname = `${brokerName}.${namespaceName}.cloudflarepubsub.com`;
    const port = parseInt(portStr);
    if (protocol !== 'mqtts' && protocol !== 'wss') throw new Error(`Unsupported protocol: ${protocol}`);

    const client = await MqttClient.create({ hostname, port, protocol });

    client.onConnectionAcknowledged = opts => {
        console.log('connection acknowledged', opts);
        if (opts.reason?.code === 0) {
            console.log('publishing');
            client.publish({ topic, payload: text });
        }
        console.log('disconnecting');
        client.disconnect();
    };

    await client.connect({ clientId, username: 'ignored', password });
    
    return client.readLoop.then(() => console.log('disconnected'));
}
