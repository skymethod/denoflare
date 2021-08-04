import { Binding, Config, isSecretBinding } from './config.ts';

export async function loadConfig(): Promise<Config> {
    const config = JSON.parse(await Deno.readTextFile(`${Deno.env.get('HOME')}/.denoflare`));
    return config as Config;
}

export async function resolveBindings(bindings: Record<string, Binding>): Promise<Record<string, Binding>> {
    const rt: Record<string, Binding> = {};
    for (const [name, binding] of Object.entries(bindings)) {
        rt[name] = await resolveBinding(binding);
    }
    return rt;
}

export async function resolveBinding(binding: Binding): Promise<Binding> {
    if (isSecretBinding(binding)) {
        const m = /^aws:(.*?)$/.exec(binding.secret);
        if (m) {
            const creds = await loadAwsCredentialsForProfile(m[1]);
            return { secret: `${creds.accessKeyId}:${creds.secretAccessKey}` };
        }
    }
    return binding;
}

//

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
