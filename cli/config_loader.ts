import { Binding, Config, Profile, Script } from '../common/config.ts';
import { checkConfig, isValidProfileName } from '../common/config_validation.ts';
import { ParseError, formatParseError, parseJsonc, ParseOptions } from './jsonc.ts';
import { join, resolve } from './deps_cli.ts';
import { fileExists } from './fs_util.ts';
import { parseOptionalStringOption } from './cli_common.ts';
import { CliCommand } from './cli_command.ts';
import { listAccounts } from '../common/cloudflare_api.ts';
import { isStringRecord } from '../common/check.ts';

export function commandOptionsForConfigOnly(command: CliCommand<unknown>) {
    return command
        .optionGroup()
        .option('config', 'string', 'Path to config file (default: .denoflare in cwd or parents)', { hint: 'path' })
}

export function commandOptionsForConfig(command: CliCommand<unknown>) {
    return commandOptionsForConfigOnly(command)
        .option('profile', 'string', 'Explicit profile to use from config file', { hint: 'name' })
        .option('accountId', 'string', 'Explicit Cloudflare account id to use for authentication')
        .option('apiToken', 'string', 'Explicit Cloudflare API token to use for authentication')
        ;
}

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
            if (cfAccountId.length > 0 && cfApiToken.length > 0) {
                if (verbose) console.log(`loadConfig: Trying to enhance with CF_ACCOUNT_ID=${cfAccountId}, CF_API_TOKEN=<redacted string length=${cfApiToken.length}>`);
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

export type ResolutionOpts = { localPort?: number, pushId?: string, awsCredentialsLoader?: (profile: string) => Promise<AwsCredentials>, envLoader?: (name: string) => string | undefined };

export async function resolveBindings(bindings: Record<string, Binding>, opts: ResolutionOpts): Promise<Record<string, Binding>> {
    const rt: Record<string, Binding> = {};
    for (const [name, binding] of Object.entries(bindings || {})) {
        rt[name] = await resolveBinding(binding, opts);
    }
    return rt;
}

export async function resolveBinding(binding: Binding, opts: ResolutionOpts): Promise<Binding> {
    binding = structuredClone(binding); // don't modify input
    const visit = async (obj: unknown) => {
        if (isStringRecord(obj)) {
            for (const key of Object.keys(obj)) {
                const value = obj[key];
                if (typeof value === 'string') {
                    obj[key] = await resolveString(value, opts);
                } else {
                    visit(value);
                }
            }
        }
    }
    await visit(binding);
    return binding;
}

export async function resolveProfile(config: Config, options: Record<string, unknown>, script?: Script, opts: ResolutionOpts = {}): Promise<Profile> {
    const profile = await findProfile(config, options, script);
    if (profile === undefined) throw new Error(`Unable to find profile, no profiles in config`);
    return await resolveProfileComponents(profile, opts);
}

export async function resolveProfileOpt(config: Config, options: Record<string, unknown>, script?: Script, opts: ResolutionOpts = {}): Promise<Profile | undefined> {
    const profile = await findProfile(config, options, script);
    if (profile === undefined) return undefined;
    return await resolveProfileComponents(profile, opts);
}

export async function loadAwsCredentialsForProfile(profile: string): Promise<AwsCredentials> {
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

async function findProfile(config: Config, options: Record<string, unknown>, script: Script | undefined): Promise<Profile | undefined> {
    const accountId = parseOptionalStringOption('account-id', options);
    const apiToken = parseOptionalStringOption('api-token', options);
    if (typeof apiToken === 'string' && apiToken.length > 0) {
        const verbose = !!options.verbose;
        if (typeof accountId === 'string' && accountId.length > 0) {
            if (verbose) console.log('Using account-id and api-token from options');
            return { accountId, apiToken };
        }
        try {
            const accounts = (await listAccounts({ apiToken })).map(v => ({ id: v.id, name: v.name }));
            if (accounts.length === 0) throw new Error('Unable to locate account-id for that api-token');
            if (accounts.length > 1) throw new Error(`Found multiple accounts for that api-token, try again with an explicit --account-id. Accounts: ${JSON.stringify(accounts)}`);
            const accountId = accounts[0].id;
            if (verbose) console.log(`Using api-token from options, and located corresponding account-id: ${accountId}`);
            return { accountId, apiToken };
        } catch (e) {
            console.warn(`Error calling listAccounts: ${e.stack || e}`);
            throw new Error(`Failed locating account-id from api-token`, { cause: e });
        }
    }
    const profiles = config.profiles || {};
    const { profile: optionProfileName } = options;
    if (optionProfileName !== undefined) {
        if (typeof optionProfileName !== 'string' || !isValidProfileName(optionProfileName)) throw new Error(`Bad profile name: ${optionProfileName}`);
        const optionProfile = profiles[optionProfileName];
        if (!optionProfile) throw new Error(`Unable to find profile ${optionProfileName} in config`);
        return optionProfile;
    }
    if (script && script.profile) {
        if (typeof script.profile !== 'string' || !isValidProfileName(script.profile)) throw new Error(`Bad profile name: ${script.profile}`);
        const scriptProfile = profiles[script.profile];
        if (!scriptProfile) throw new Error(`Unable to find profile ${scriptProfile} in config`);
        return scriptProfile;
    }
    const profilesArr = Object.values(profiles);
    if (profilesArr.length == 0) return undefined;
    const defaultProfiles = profilesArr.filter(v => v.default);
    if (defaultProfiles.length === 1) return defaultProfiles[0];
    if (profilesArr.length === 1) return profilesArr[0];
    throw new Error(`Unable to find profile, ${profilesArr.length} profiles in config, and ${defaultProfiles.length} marked as default`);
}

async function resolveProfileComponents(profile: Profile, opts: ResolutionOpts): Promise<Profile> {
    const accountId = await resolveString(profile.accountId, opts);
    const apiToken = await resolveString(profile.apiToken, opts);
    return { accountId, apiToken };
}

async function resolveString(string: string, { localPort, pushId, awsCredentialsLoader = loadAwsCredentialsForProfile, envLoader = Deno.env.get }: ResolutionOpts): Promise<string> {
    const rt: string[] = [];
    const p = /\$\{((aws|env|regex):)?(.*?)\}/g
    let m: RegExpExecArray | null;
    let pos = 0;
    while ((m = p.exec(string)) !== null) {
        if (m.index > pos) rt.push(string.substring(pos, m.index));
        const [ substring, _, prefix, suffix ] = m;
        if (prefix === 'aws') {
            const creds = await awsCredentialsLoader(suffix);
            rt.push(`${creds.accessKeyId}:${creds.secretAccessKey}`);
        } else if (prefix === 'env') {
            const val = envLoader(suffix);
            if (typeof val !== 'string') throw new Error(`Unable to resolve ${substring}`);
            rt.push(val);
        } else if (prefix === 'regex') {
            const str = suffix;
            const i = str.indexOf(':');
            if (i < 0) throw new Error(`Unable to resolve ${substring}`);
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
                throw new Error(`Unable to resolve ${substring}`);
            }
        } else if (suffix === 'localPort' && localPort) {
            rt.push(localPort.toString());
        } else if (suffix === 'pushId' && pushId) {
            rt.push(pushId);
        } else {
            throw new Error(`Unable to resolve ${substring}`);
        }
        pos = m.index + substring.length;
    }
    if (pos < string.length) rt.push(string.substring(pos));
    return rt.join('');
}

//

interface AwsCredentials {
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
}
