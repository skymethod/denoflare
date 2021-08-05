import { Binding, Config, Credential, isSecretBinding, isTextBinding } from './config.ts';

export async function loadConfig(): Promise<Config> {
    const config = JSON.parse(await Deno.readTextFile(`${Deno.env.get('HOME')}/.denoflare`));
    return config as Config;
}

export async function resolveBindings(bindings: Record<string, Binding>, localPort: number): Promise<Record<string, Binding>> {
    const rt: Record<string, Binding> = {};
    for (const [name, binding] of Object.entries(bindings)) {
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

export async function resolveCredential(config: Config): Promise<Credential> {
    const entries = [...Object.entries(config.credentials)];
    if (entries.length !== 1) throw new Error(`Unable to resolve credential, found ${entries.length} credentials`);
    const credential = entries[0][1];
    const accountId = await resolveString(credential.accountId);
    const apiToken = await resolveString(credential.apiToken);
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
