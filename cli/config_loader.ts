import { Binding, Config, isSecretBinding, isTextBinding, Profile } from '../common/config.ts';
import { checkConfig } from '../common/config_validation.ts';
import { ParseError, formatParseError, parseJsonc, ParseOptions } from './jsonc.ts';

export async function loadConfig(): Promise<Config> {
    const path = `${Deno.env.get('HOME')}/.denoflare`;
    const errors: ParseError[] = [];
    const options: ParseOptions = { allowTrailingComma: true, disallowComments: false };
    try {
        const jsonc = await Deno.readTextFile(path);
        const config = parseJsonc(jsonc, errors, options);
        if (errors.length > 0) {
            throw new Error(`Invalid json, error${errors.length > 1 ? 's' : ''}=${errors.map(v => `(${formatParseError(v, jsonc)})`).join(' ')}`);
        }
        return checkConfig(config);
    } catch (e) {
        throw new Error(`Error loading config (path=${path}): ${e.message || e}`);
    }
}

export async function resolveBindings(bindings: Record<string, Binding>, localPort: number): Promise<Record<string, Binding>> {
    const rt: Record<string, Binding> = {};
    for (const [name, binding] of Object.entries(bindings || {})) {
        rt[name] = await resolveBinding(binding, localPort);
    }
    return rt;
}

export async function resolveBinding(binding: Binding, localPort: number): Promise<Binding> {
    if (isSecretBinding(binding)) {
        const m = /^aws:(.*?)$/.exec(binding.secret);
        if (m) {
            const creds = await loadAwsCredentialsForProfile(m[1]);
            return { secret: `${creds.accessKeyId}:${creds.secretAccessKey}` };
        }
    } else if (isTextBinding(binding)) {
        const value = binding.value.replaceAll('${localPort}', localPort.toString());
        return { value };
    }
    return binding;
}

export async function resolveProfile(config: Config): Promise<Profile> {
    const profiles = config.profiles !== undefined ? [...Object.entries(config.profiles)] : [];
    if (profiles.length !== 1) throw new Error(`Unable to resolve profile, found ${profiles.length} profiles`);
    const profile = profiles[0][1];
    const accountId = await resolveString(profile.accountId);
    const apiToken = await resolveString(profile.apiToken);
    return { accountId, apiToken };
}

//

async function resolveString(string: string): Promise<string> {
    if (string.startsWith('regex:')) {
        const str = string.substring('regex:'.length);
        const i = str.indexOf(':');
        if (i > -1) {
            const path = str.substring(0, i);
            const txt = await Deno.readTextFile(path);
            const pattern = str.substring(i + 1);
            const m = txt.match(new RegExp(pattern));
            if (m) {
                return m[1];
            }
        }
    }
    return string;
}

async function loadAwsCredentialsForProfile(profile: string): Promise<AwsCredentials> {
    const txt = await Deno.readTextFile(`${Deno.env.get('HOME')}/.aws/credentials`);
    const profileLine = '[' + profile + ']';
    let inProfile = false;
    const atts = new Map<string, string>();
    for (const line of txt.split('\n')) {
        if (line.startsWith('[') && line.endsWith(']')) {
            inProfile = line === profileLine;
        } else if (inProfile) {
            const i = line.indexOf('=');
            if (i > -1) {
                const name = line.substring(0, i).trim();
                const value = line.substring(i + 1).trim();
                atts.set(name, value);
            }
        }
    }
    const accessKeyId = atts.get('aws_access_key_id');
    const secretAccessKey = atts.get('aws_secret_access_key');
    if (accessKeyId !== undefined && secretAccessKey !== undefined) {
        return { accessKeyId, secretAccessKey };
    }
    throw new Error(`No aws credentials found for profile ${profile}`);
}

//

interface AwsCredentials {
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
}
