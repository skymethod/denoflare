import { checkMatchesReturnMatcher } from '../common/check.ts';
import { Mqtt } from '../common/mqtt/mqtt.ts';
import { MqttClient } from '../common/mqtt/mqtt_client.ts';
import { denoflareCliCommand } from './cli_common.ts';
import { commandOptionsForPubsub, parsePubsubOptions } from './cli_pubsub.ts';

export const PUBLISH_COMMAND = denoflareCliCommand(['pubsub', 'publish'], 'Publish a message to a Pub/Sub broker')
    .option('text', 'string', 'Plaintext message payload')
    .option('file', 'string', 'Path to file with the message payload')
    .option('topic', 'required-string', 'Topic on which to publish the message')
    .include(commandOptionsForPubsub())
    .docsLink('/cli/pubsub#publish')
    ;

export async function publish(args: (string | number)[], options: Record<string, unknown>) {
    if (PUBLISH_COMMAND.dumpHelp(args, options)) return;

    const { verbose, text, file, topic } = PUBLISH_COMMAND.parse(args, options);

    if ((text ?? file) === undefined) throw new Error(`Specify a payload with --text or --file`);
    const payload = text ? text : await Deno.readFile(file!);

    if (verbose) {
        Mqtt.DEBUG = true;
    }

    const { endpoint, clientId, password, debug } = parsePubsubOptions(options);

    const [ _, protocol, brokerName, namespaceName, portStr] = checkMatchesReturnMatcher('endpoint', endpoint, /^(mqtts|wss):\/\/(.*?)\.(.*?)\.cloudflarepubsub\.com:(\d+)$/);

    const hostname = `${brokerName}.${namespaceName}.cloudflarepubsub.com`;
    const port = parseInt(portStr);
    if (protocol !== 'mqtts' && protocol !== 'wss') throw new Error(`Unsupported protocol: ${protocol}`);

    const client = new MqttClient({ hostname, port, protocol });
    if (debug) client.onMqttMessage = message => console.log(JSON.stringify(message, undefined, 2));

    console.log('connecting');
    await client.connect({ clientId, password });

    console.log('publishing');
    await client.publish({ topic, payload });

    await client.completion();

    console.log('disconnecting');
    await client.disconnect();

    console.log('disconnected');
}
