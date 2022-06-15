import { denoflareCliCommand, parseOptionalBooleanOption, parseOptionalStringOption, parseRequiredStringOption } from './cli_common.ts';
import { CliCommandModifier } from './cli_command.ts';
import { publish, PUBLISH_COMMAND } from './cli_pubsub_publish.ts';
import { subscribe, SUBSCRIBE_COMMAND } from './cli_pubsub_subscribe.ts';

export const PUBSUB_COMMAND = denoflareCliCommand('pubsub', 'Publish or subscribe to a Cloudflare Pub/Sub broker')
    .subcommand(PUBLISH_COMMAND, publish)
    .subcommand(SUBSCRIBE_COMMAND, subscribe)

    .docsLink('/cli/pubsub')
    ;

export async function pubsub(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    await PUBSUB_COMMAND.routeSubcommand(args, options, { tmp });
}

export function commandOptionsForPubsub(): CliCommandModifier {
    return command => command
        .optionGroup()
        .option('endpoint', 'required-string', 'MQTT endpoint') // e.g. mqtts://<broker-name>.<namespace-name>.cloudflarepubsub.com:8883
        .option('clientId', 'string', 'Client ID')
        .option('password', 'required-string', 'Password')
        .option('debug', 'boolean', '')
        ;
}

export function parsePubsubOptions(options: Record<string, unknown>): { endpoint: string, clientId?: string, password: string, debug?: boolean } {
    const endpoint = parseRequiredStringOption('endpoint', options);
    const clientId = parseOptionalStringOption('client-id', options);
    const password = parseRequiredStringOption('password', options);
    const debug = parseOptionalBooleanOption('debug', options);
    return { endpoint, clientId, password, debug };
}

//

async function tmp(_args: (string | number)[], _options: Record<string, unknown>): Promise<void> {
    // await generateReasonCodes('Disconnect Reason Code values');
    // await generateReasonCodes('Connect Reason Code values');
    await generateReasonCodes('Subscribe Reason Codes');
}

async function generateReasonCodes(type: string) {
    const despan = (v: string) => {
        const m = />(.*?)</s.exec(v);
        return m ? m[1] : v;
    };
    const fixWhitespace = (v: string) => v.replaceAll(/\s+/gs, ' ').trim();
    const res = await fetch('https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html');
    const text = await res.text();
    let m = new RegExp(type + '</p>\\s+(<table.*?</table>)', 'si').exec(text);
    if (m) {
        const table = m[1];
        const pattern = /<tr.*?<p class=MsoNormal>(.*?)<\/p>.*?<p class=MsoNormal>(.*?)<\/p>.*?<p class=MsoNormal>(.*?)<\/p>.*?<p class=MsoNormal>(.*?)<\/p>.*?<\/tr>/gs;
        while (null != (m = pattern.exec(table))) {
            const codeStr = despan(m[1]);
            const name = fixWhitespace(despan(m[3].trim()));
            const description = fixWhitespace(m[4]);
            const code = parseInt(codeStr);
            console.log(`    ${code}: [ '${name}', '${description}' ],`);
        }
    }
}
