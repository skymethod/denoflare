import { Config, Profile, Script } from './config.ts';
import { checkObject } from './check.ts';

// deno-lint-ignore no-explicit-any
export function checkConfig(config: any): Config {
    checkObject('config', config);
    const { scripts, profiles } = config;
    const profileNames = new Set<string>();
    if (profiles !== undefined) {
        checkObject('profiles', profiles);
        let defaultCount = 0;
        for (const [profileName, profile] of Object.entries(profiles)) {
            if (!isValidProfileName(profileName)) throw new Error(`Bad profileName: ${profileName}`);
            const { default: default_ } = checkProfile(`profiles.${profileName}`, profile);
            if (default_) defaultCount++;
            profileNames.add(profileName);
        }
        if (defaultCount > 1) throw new Error(`Bad profiles: more than one default profile`);
    }
    if (scripts !== undefined) {
        checkObject('scripts', scripts);
        for (const [scriptName, script] of Object.entries(scripts)) {
            if (!isValidScriptName(scriptName)) throw new Error(`Bad scriptName: ${scriptName}`);
            const { profile } = checkScript(`scripts.${scriptName}`, script);
            if (profile && !profileNames.has(profile)) throw new Error(`Bad scripts.${scriptName}.profile: ${profile} not found`);

        }
    }
    return config as Config;
}

/**
 * Script names must:
 *  - start with a letter
 *  - end with a letter or digit
 *  - include only lowercase letters, digits, underscore, and hyphen
 *  - be 63 characters or less
 */
 export function isValidScriptName(scriptName: string): boolean {
    return scriptName.length > 0 
        && /^[a-z][a-z0-9_-]{0,63}$/.test(scriptName)
        && /^[a-z0-9]$/.test(scriptName.charAt(scriptName.length - 1));
}

/**
 * Profile names must:
 *  - start with a letter
 *  - end with a letter or digit
 *  - include only lowercase letters, digits, and hyphen
 *  - be 36 characters or less
 */
export function isValidProfileName(profileName: string): boolean {
    return profileName.length > 0 
        && /^[a-z][a-z0-9_-]{0,36}$/.test(profileName)
        && /^[a-z0-9]$/.test(profileName.charAt(profileName.length - 1));
}

//

function isValidBindingName(bindingName: string): boolean {
    return /^[a-zA-Z0-9_]+$/.test(bindingName);
}

function isValidLocalPort(localPort: number): boolean {
    return Math.round(localPort) === localPort && localPort >= 0 && localPort <= 65535;
}

function isValidCpuLimit(cpuLimit: number): boolean {
    return Number.isSafeInteger(cpuLimit) && cpuLimit >= 0;
}

function isValidAccountId(accountId: string): boolean {
    return /^[0-9a-f]{32}$/.test(accountId)
}

function isValidApiToken(apiToken: string): boolean {
    return /^[^\s]{10,}$/.test(apiToken);
}

function isValidCustomDomain(customDomain: string): boolean {
    return /^([a-zA-Z0-9][a-zA-Z0-9-]*\.)+[\-a-zA-Z0-9]{2,20}$/.test(customDomain); // taken from cloudflare api Zone.name validation, should work for subdomains
}

// deno-lint-ignore no-explicit-any
function checkScript(name: string, script: any): Script {
    checkObject(name, script);
    const { path, bindings, localPort, localHostname, localIsolation, localCertPem, localKeyPem, profile, usageModel, customDomains, workersDev, logpush, compatibilityDate, compatibilityFlags, lambda, deploy, supabase, cpuLimit } = script;
    if (path !== undefined && typeof path !== 'string') throw new Error(`Bad ${name}.path: expected string, found ${typeof path}`);
    if (bindings !== undefined) {
        checkObject(`${name}.bindings`, bindings);
        for (const [bindingName, binding] of Object.entries(bindings)) {
            if (!isValidBindingName(bindingName)) throw new Error(`Bad bindingName: ${bindingName}`);
            checkBinding(`${name}.bindings.${bindingName}`, binding);
        }
    }
    if (localPort !== undefined) {
        if (typeof localPort !== 'number') throw new Error(`Bad ${name}.localPort: expected number, found ${typeof localPort}`);
        if (!isValidLocalPort(localPort)) throw new Error(`Bad ${name}.localPort: ${localPort}`);
    }
    if (localHostname !== undefined && typeof localHostname !== 'string') throw new Error(`Bad ${name}.localHostname: expected string, found ${typeof localHostname}`);
    if (localIsolation !== undefined && localIsolation !== 'none' && localIsolation !== 'isolate') throw new Error(`Bad ${name}.localIsolation: expected none | isolate, found ${localIsolation}`);
    if (localCertPem !== undefined && typeof localCertPem !== 'string') throw new Error(`Bad ${name}.localCertPem: expected string, found ${typeof localCertPem}`);
    if (localKeyPem !== undefined && typeof localKeyPem !== 'string') throw new Error(`Bad ${name}.localKeyPem: expected string, found ${typeof localKeyPem}`);
    if (profile !== undefined) {
        if (typeof profile !== 'string' || !isValidProfileName(profile)) throw new Error(`Bad ${name}.profile: ${profile}`);
    }
    if (usageModel !== undefined && usageModel !== 'bundled' && usageModel !== 'unbound') throw new Error(`Bad ${name}.usageModel: expected bundled | unbound, found ${usageModel}`);
    if (customDomains !== undefined && !(Array.isArray(customDomains) && customDomains.every(v => typeof v === 'string' && isValidCustomDomain(v)))) throw new Error(`Bad ${name}.customDomains: expected string array of domain names, found ${customDomains}`);
    if (workersDev !== undefined && typeof workersDev !== 'boolean') throw new Error(`Bad ${name}.workersDev: expected boolean, found ${typeof workersDev}`);
    if (logpush !== undefined && typeof logpush !== 'boolean') throw new Error(`Bad ${name}.logpush: expected boolean, found ${typeof logpush}`);
    if (compatibilityDate !== undefined && (typeof compatibilityDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(compatibilityDate))) throw new Error(`Bad ${name}.compatibilityDate: expected date string, found ${typeof compatibilityDate} ${compatibilityDate}`);
    if (compatibilityFlags !== undefined && !(Array.isArray(compatibilityFlags) && compatibilityFlags.every(v => typeof v === 'string'))) throw new Error(`Bad ${name}.compatibilityFlags: expected string array of flags, found ${compatibilityFlags}`);
    if (lambda !== undefined && typeof lambda !== 'string') throw new Error(`Bad ${name}.lambda: expected string, found ${typeof lambda} ${lambda}`);
    if (deploy !== undefined && typeof deploy !== 'string') throw new Error(`Bad ${name}.deploy: expected string, found ${typeof deploy} ${deploy}`);
    if (supabase !== undefined && typeof supabase !== 'string') throw new Error(`Bad ${name}.supabase: expected string, found ${typeof supabase} ${supabase}`);
    if (cpuLimit !== undefined) {
        if (typeof cpuLimit !== 'number') throw new Error(`Bad ${name}.cpuLimit: expected number, found ${typeof cpuLimit}`);
        if (!isValidCpuLimit(cpuLimit)) throw new Error(`Bad ${name}.cpuLimit: ${cpuLimit}`);
    }

    return script as Script;
}

// deno-lint-ignore no-explicit-any
function checkBinding(name: string, binding: any) {
    checkObject(name, binding);
    const { value, secret, kvNamespace, doNamespace, wasmModule, serviceEnvironment, bucketName, dataset, d1DatabaseUuid, queueName, secretKey, browser, ai, hyperdrive, versionMetadata, sendEmailDestinationAddresses, ratelimit } = binding;
    const definedCount = [ value, secret, kvNamespace, doNamespace, wasmModule, serviceEnvironment, bucketName, dataset, d1DatabaseUuid, queueName, secretKey, browser, ai, hyperdrive, versionMetadata, sendEmailDestinationAddresses, ratelimit ].filter(v => v !== undefined).length;
    if (definedCount === 1) {
        if (value !== undefined && typeof value !== 'string') throw new Error(`Bad ${name}.value: expected string, found ${typeof value}`);
        else if (secret !== undefined && typeof secret !== 'string') throw new Error(`Bad ${name}.secret: expected string, found ${typeof secret}`);
        else if (kvNamespace !== undefined && typeof kvNamespace !== 'string') throw new Error(`Bad ${name}.kvNamespace: expected string, found ${typeof kvNamespace}`);
        else if (doNamespace !== undefined && typeof doNamespace !== 'string') throw new Error(`Bad ${name}.doNamespace: expected string, found ${typeof doNamespace}`);
        else if (wasmModule !== undefined && typeof wasmModule !== 'string') throw new Error(`Bad ${name}.wasmModule: expected string, found ${typeof wasmModule}`);
        else if (serviceEnvironment !== undefined && typeof serviceEnvironment !== 'string') throw new Error(`Bad ${name}.serviceEnvironment: expected string, found ${typeof serviceEnvironment}`);
        else if (bucketName !== undefined && typeof bucketName !== 'string') throw new Error(`Bad ${name}.bucketName: expected string, found ${typeof bucketName}`);
        else if (dataset !== undefined && typeof dataset !== 'string') throw new Error(`Bad ${name}.dataset: expected string, found ${typeof dataset}`);
        else if (d1DatabaseUuid !== undefined && typeof d1DatabaseUuid !== 'string') throw new Error(`Bad ${name}.d1DatabaseUuid: expected string, found ${typeof d1DatabaseUuid}`);
        else if (queueName !== undefined && typeof queueName !== 'string') throw new Error(`Bad ${name}.queueName: expected string, found ${typeof queueName}`);
        else if (secretKey !== undefined && typeof secretKey !== 'string') throw new Error(`Bad ${name}.secretKey: expected string, found ${typeof secretKey}`);
        else if (browser !== undefined && typeof browser !== 'string') throw new Error(`Bad ${name}.browser: expected string, found ${typeof browser}`);
        else if (ai !== undefined && typeof ai !== 'string') throw new Error(`Bad ${name}.ai: expected string, found ${typeof ai}`);
        else if (hyperdrive !== undefined && typeof hyperdrive !== 'string') throw new Error(`Bad ${name}.hyperdrive: expected string, found ${typeof hyperdrive}`);
        else if (versionMetadata !== undefined && typeof versionMetadata !== 'string') throw new Error(`Bad ${name}.versionMetadata: expected string, found ${typeof versionMetadata}`);
        else if (sendEmailDestinationAddresses !== undefined && typeof sendEmailDestinationAddresses !== 'string') throw new Error(`Bad ${name}.sendEmailDestinationAddresses: expected string, found ${typeof sendEmailDestinationAddresses}`);
        else if (ratelimit !== undefined && typeof ratelimit !== 'string') throw new Error(`Bad ${name}.ratelimit: expected string, found ${typeof ratelimit}`);
    } else {
        throw new Error(`Bad ${name}: ${binding}`);
    }
}

// deno-lint-ignore no-explicit-any
function checkProfile(name: string, profile: any): Profile {
    checkObject(name, profile);
    const { accountId, apiToken, default: _default } = profile;
    if (typeof accountId !== 'string' || !hasSubstitutionsOr(isValidAccountId)(accountId)) throw new Error(`Bad ${name}.accountId: ${accountId}`);
    if (typeof apiToken !== 'string' || !isValidApiToken(apiToken)) throw new Error(`Bad ${name}.apiToken`);
    if (_default !== undefined && typeof _default !== 'boolean') throw new Error(`Bad ${name}.default: ${_default}`);
    return profile as Profile;
}

function hasSubstitutionsOr(pred: (str: string) => boolean): (str: string) => boolean {
    return str => hasSubstitutions(str) || pred(str);
}

function hasSubstitutions(str: string): boolean {
    return /\$\{.*?\}/.test(str);
}
