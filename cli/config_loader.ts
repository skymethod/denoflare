import { Binding, Config, isSecretBinding, isTextBinding, Profile } from '../common/config.ts';
import { checkConfig, isValidProfileName } from '../common/config_validation.ts';
import { ParseError, formatParseError, parseJsonc, ParseOptions } from './jsonc.ts';
import { join, resolve } from './deps_cli.ts';
import { fileExists } from './fs_util.ts';
import { parseOptionalStringOption } from './cli_common.ts';

export async function loadConfig(options: Record<string, unknown>): Promise<Config> {
    const verbose = !!options.verbose;
    const optionConfigFilePath = typeof options.config === 'string' && options.config.trim().length > 0 ? options.config.trim() : undefined;
    const configFilePath = optionConfigFilePath || await findConfigFilePath(verbose);
    if (verbose) console.log(`loadConfig: path=${configFilePath}`);
    let config = configFilePath ? await loadConfigFromFile(configFilePath) : {};

    // enhance with env vars if we have no config profiles
    if (Object.keys(config.profiles || {}).length === 0) {
        try {
            const cfAccountId = (Deno.env.get('CF_ACCOUNT_ID') || '').trim();
            const cfApiToken = (Deno.env.get('CF_API_TOKEN') || '').trim();
            if (verbose) console.log(`loadConfig: Trying to enhance with CF_ACCOUNT_ID=${cfAccountId}, CF_API_TOKEN=<redacted string length=${cfApiToken.length}>`);
            if (cfAccountId.length > 0 && cfApiToken.length > 0) {
                const envProfile: Profile = {
                    accountId: cfAccountId,
                    apiToken: cfApiToken,
                };
                config = { ...config, profiles: { 'env': envProfile } };
            }
        } catch (e) {
            if (e instanceof Deno.errors.PermissionDenied) {
                if (verbose) console.log(`loadConfig: Permission denied reading CF_ACCOUNT_ID or CF_API_TOKEN`);
            } else {
                throw e;
            }
        }
    }

    return config;
}

export async function resolveBindings(bindings: Record<string, Binding>, localPort: number | undefined, pushId: string | undefined): Promise<Record<string, Binding>> {
    const rt: Record<string, Binding> = {};
    for (const [name, binding] of Object.entries(bindings || {})) {
        rt[name] = await resolveBinding(binding, localPort, pushId);
    }
    return rt;
}

export async function resolveBinding(binding: Binding, localPort: number | undefined, pushId: string | undefined): Promise<Binding> {
    if (isSecretBinding(binding)) {
        const m = /^aws:(.*?)$/.exec(binding.secret);
        if (m) {
            const creds = await loadAwsCredentialsForProfile(m[1]);
            return { secret: `${creds.accessKeyId}:${creds.secretAccessKey}` };
        }
    } else if (isTextBinding(binding)) {
        let value = binding.value;
        if (localPort === undefined) {
            if (binding.value.includes('${localPort}')) throw new Error(`Cannot resolve: localPort`);
        } else {
            value = value.replace('${localPort}', localPort.toString());
        }
        if (pushId === undefined) {
            if (value.includes('${pushId}')) throw new Error(`Cannot resolve: pushId`);
        } else {
            value = value.replace('${pushId}', pushId);
        }
        return { value };
    }
    return binding;
}

export async function resolveProfile(config: Config, options: Record<string, unknown>): Promise<Profile> {
    const profile = findProfile(config, options);
    if (profile === undefined) throw new Error(`Unable to find profile, no profiles in config`);
    return await resolveProfileComponents(profile);
}

export async function resolveProfileOpt(config: Config, options: Record<string, unknown>): Promise<Profile | undefined> {
    const profile = findProfile(config, options);
    if (profile === undefined) return undefined;
    return await resolveProfileComponents(profile);
}

//

const CONFIG_FILE_NAME = '.denoflare';

async function loadConfigFromFile(path: string): Promise<Config> {
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

async function findConfigFilePath(verbose: boolean): Promise<string | undefined> {
    try {
        let dir = Deno.cwd();
        while (true) {
            const filePath = join(dir, CONFIG_FILE_NAME);
            if (await fileExists(filePath)) {
                return filePath;
            }
            const parentDir = resolve(dir, '..');
            if (parentDir === dir) {
                return undefined; // as far as we can go
            }
            dir = parentDir;
        }
    } catch (e) {
        if (e instanceof Deno.errors.PermissionDenied) {
            if (verbose) console.warn(`findConfigFilePath: Permission denied: ${e.message}`)
            return undefined;
        } else {
            throw e;
        }
    }
}

function findProfile(config: Config, options: Record<string, unknown>): Profile | undefined {
    const accountId = parseOptionalStringOption('account-id', options);
    const apiToken = parseOptionalStringOption('api-token', options);
    if (typeof accountId === 'string' && accountId.length > 0 && typeof apiToken === 'string' && apiToken.length > 0) {
        const verbose = !!options.verbose;
        if (verbose) console.log('Using account-id and api-token from options');
        return { accountId, apiToken };
    }
    const profiles = config.profiles || {};
    const { profile: optionProfileName } = options;
    if (optionProfileName !== undefined) {
        if (typeof optionProfileName !== 'string' || !isValidProfileName(optionProfileName)) throw new Error(`Bad profile name: ${optionProfileName}`);
        const optionProfile = profiles[optionProfileName];
        if (!optionProfile) throw new Error(`Unable to find profile ${optionProfileName} in config`);
        return optionProfile;
    }
    const profilesArr = Object.values(profiles);
    if (profilesArr.length == 0) return undefined;
    const defaultProfiles = profilesArr.filter(v => v.default);
    if (defaultProfiles.length === 1) return defaultProfiles[0];
    if (profilesArr.length === 1) return profilesArr[0];
    throw new Error(`Unable to find profile, ${profilesArr.length} profiles in config, and ${defaultProfiles.length} marked as default`);
}

async function resolveProfileComponents(profile: Profile): Promise<Profile> {
    const accountId = await resolveString(profile.accountId);
    const apiToken = await resolveString(profile.apiToken);
    const apiTokenId = profile.apiTokenId ? await resolveString(profile.apiTokenId) : undefined;
    return { accountId, apiToken, apiTokenId };
}

async function resolveString(string: string): Promise<string> {
    if (string.startsWith('regex:')) {
        const str = string.substring('regex:'.length);
        const i = str.indexOf(':');
        if (i > -1) {
            const path = str.substring(0, i);
            const txt = await Deno.readTextFile(path);
            let pattern = str.substring(i + 1);
            let flags: string | undefined;
            if (pattern.startsWith('(?s)')) {
                pattern = pattern.substring(4);
                flags = 's';
            }
            const m = txt.match(new RegExp(pattern, flags));
            if (m) {
                return m[1];
            } else {
                throw new Error(`resolveString: Failed to resolve ${string}`);
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
