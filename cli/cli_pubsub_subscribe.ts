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

    const { endpoint, clientId, password, debug } = parsePubsubOptions(options);

    const [ _, protocol, brokerName, namespaceName, portStr] = checkMatchesReturnMatcher('endpoint', endpoint, /^(mqtts|wss):\/\/(.*?)\.(.*?)\.cloudflarepubsub\.com:(\d+)$/);

    const hostname = `${brokerName}.${namespaceName}.cloudflarepubsub.com`;
    const port = parseInt(portStr);
    if (protocol !== 'mqtts' && protocol !== 'wss') throw new Error(`Unsupported protocol: ${protocol}`);

    const client = new MqttClient({ hostname, port, protocol });

    if (debug) client.onMqttMessage = message => console.log(JSON.stringify(message, undefined, 2));

    client.onReceive = opts => {
        const { topic, payload, contentType } = opts;
        const display = typeof payload === 'string' ? payload : `(${payload.length} bytes)${payload.length < 1000 ? ` ${new Bytes(payload).utf8()}` : ''}`;
        console.log(`[${topic}]${contentType ? ` [content-type: ${contentType}]` : ''} ${display}`);
    };

    console.log('connecting');
    await client.connect({ clientId, password });

    console.log('subscribing');
    await client.subscribe({ topicFilter: topic });

    console.log('listening');
    await client.completion();
    console.log('completed');
}
