import { denoflareCliCommand, parseOptionalBooleanOption, parseOptionalIntegerOption, parseOptionalStringOption, parseRequiredStringOption } from './cli_common.ts';
import { CliCommandModifier } from './cli_command.ts';
import { publish, PUBLISH_COMMAND } from './cli_pubsub_publish.ts';
import { subscribe, SUBSCRIBE_COMMAND } from './cli_pubsub_subscribe.ts';
import { decodeJwt } from '../common/jwt.ts';
import { commandOptionsForConfig, loadConfig, resolveProfile } from './config_loader.ts';
import { generatePubsubCredentials } from '../common/cloudflare_api.ts';
import { Protocol } from '../common/mqtt/mqtt_client.ts';
import { checkMatchesReturnMatcher } from '../common/check.ts';
import { Mqtt } from '../common/mqtt/mqtt.ts';
import { generateNpm } from './cli_pubsub_generate_npm.ts';

const JWT_COMMAND = denoflareCliCommand(['pubsub', 'jwt'], `Parse a JWT token, and output its claims`)
    .arg('token', 'string', 'JWT token string')
    .docsLink('/cli/pubsub#jwt')
    ;

export const PUBSUB_COMMAND = denoflareCliCommand('pubsub', 'Publish or subscribe to a Cloudflare Pub/Sub broker')
    .subcommand(PUBLISH_COMMAND, publish)
    .subcommand(SUBSCRIBE_COMMAND, subscribe)
    .subcommand(JWT_COMMAND, jwt)

    .docsLink('/cli/pubsub')
    ;

export async function pubsub(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    await PUBSUB_COMMAND.routeSubcommand(args, options, { tmp, generateNpm });
}

export function commandOptionsForPubsub(): CliCommandModifier {
    return command => command
        .optionGroup()
        .option('endpoint', 'required-string', 'MQTT endpoint') // e.g. mqtts://<broker-name>.<namespace-name>.cloudflarepubsub.com:8883
        .option('clientId', 'string', 'Client ID')
        .option('password', 'string', 'Password')
        .option('keepAlive', 'integer', 'Keep alive rate (in seconds)')
        .option('debugMessages', 'boolean', 'Dump all received mqtt messages')
        .option('debugJwt', 'boolean', 'If the password is a jwt token, dump the claims')
        .include(commandOptionsForConfig)
        ;
}

export async function parsePubsubOptions(options: Record<string, unknown>): Promise<{ endpoint: string, clientId?: string, password: string, keepAlive?: number, debugMessages?: boolean, debugJwt?: boolean }> {
    const endpoint = parseRequiredStringOption('endpoint', options);
    const clientId = parseOptionalStringOption('client-id', options);
    const passwordOpt = parseOptionalStringOption('password', options);
    const keepAlive = parseOptionalIntegerOption('keep-alive', options); // cloudflare found min = 10, max = 3600
    const debugMessages = parseOptionalBooleanOption('debug-messages', options);
    const debugJwt = parseOptionalBooleanOption('debug-jwt', options);

    const password = passwordOpt ?? await generatePubsubCredential(options, endpoint);

    if (debugJwt) {
        dumpJwt(password);
    }

    return { endpoint, clientId, password, keepAlive, debugMessages, debugJwt };
}

export function parseCloudflareEndpoint(endpoint: string): { protocol: Protocol, brokerName: string, namespaceName: string, hostname: string, port: number } {
    const [ _, protocol, brokerName, namespaceName, portStr ] = checkMatchesReturnMatcher('endpoint', endpoint, /^(mqtts|wss):\/\/(.*?)\.(.*?)\.cloudflarepubsub\.com:(\d+)$/);

    const hostname = `${brokerName}.${namespaceName}.cloudflarepubsub.com`;
    const port = parseInt(portStr);
    if (protocol !== 'mqtts' && protocol !== 'wss') throw new Error(`Unsupported protocol: ${protocol}`);
    return { protocol, brokerName, namespaceName, hostname, port };
}

//

async function generatePubsubCredential(options: Record<string, unknown>, endpoint: string): Promise<string> {
    const { DEBUG } = Mqtt;
    console.log('generating credential');
    const { accountId, apiToken } = await resolveProfile(await loadConfig(options), options);
    const { namespaceName, brokerName } = parseCloudflareEndpoint(endpoint);
    const results = await generatePubsubCredentials(accountId, apiToken, namespaceName, brokerName, { number: 1, type: 'TOKEN', topicAcl: '#' });
    for (const [ _clientId, token ] of Object.entries(results)) {
        if (DEBUG) console.log({ token });
        return token;
    }
    throw new Error(`generatePubsubCredentials returned no results`);
}

function jwt(args: (string | number)[], _options: Record<string, unknown>): void {
    dumpJwt(String(args[0]));
}

function dumpJwt(token: string) {
    const { header, claims, signature } = decodeJwt(token);
    let obj: Record<string, unknown> = { header, claims, signatureLength: signature.length };
    if (typeof claims.iat === 'number') obj = { ...obj, issued: new Date(claims.iat * 1000).toISOString() };
    if (typeof claims.exp === 'number') obj = { ...obj, expires: new Date(claims.exp * 1000).toISOString() };
    console.log(JSON.stringify(obj, undefined, 2));
}

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
