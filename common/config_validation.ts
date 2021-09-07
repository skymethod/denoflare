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

function isValidAccountId(accountId: string): boolean {
    return /^(regex:.*|[0-9a-f]{32})$/.test(accountId)
}

function isValidApiToken(apiToken: string): boolean {
    return /^[^\s]{10,}$/.test(apiToken);
}

// deno-lint-ignore no-explicit-any
function checkScript(name: string, script: any): Script {
    checkObject(name, script);
    const { path, bindings, localPort, localHostname, localIsolation, profile } = script;
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
    if (profile !== undefined) {
        if (typeof profile !== 'string' || !isValidProfileName(profile)) throw new Error(`Bad ${name}.profile: ${profile}`);
    }
    return script as Script;
}

// deno-lint-ignore no-explicit-any
function checkBinding(name: string, binding: any) {
    checkObject(name, binding);
    const { value, secret, kvNamespace, doNamespace } = binding;
    const definedCount = [value, secret, kvNamespace, doNamespace].filter(v => v !== undefined).length;
    if (definedCount === 1) {
        if (value !== undefined && typeof value !== 'string') throw new Error(`Bad ${name}.value: expected string, found ${typeof value}`);
        else if (secret !== undefined && typeof secret !== 'string') throw new Error(`Bad ${name}.secret: expected string, found ${typeof secret}`);
        else if (kvNamespace !== undefined && typeof kvNamespace !== 'string') throw new Error(`Bad ${name}.kvNamespace: expected string, found ${typeof kvNamespace}`);
        else if (doNamespace !== undefined && typeof doNamespace !== 'string') throw new Error(`Bad ${name}.doNamespace: expected string, found ${typeof doNamespace}`);
    } else {
        throw new Error(`Bad ${name}: ${binding}`);
    }
}

// deno-lint-ignore no-explicit-any
function checkProfile(name: string, profile: any): Profile {
    checkObject(name, profile);
    const { accountId, apiToken, default: _default } = profile;
    if (typeof accountId !== 'string' || !isValidAccountId(accountId)) throw new Error(`Bad ${name}.accountId: ${accountId}`);
    if (typeof apiToken !== 'string' || !isValidApiToken(apiToken)) throw new Error(`Bad ${name}.apiToken`);
    if (_default !== undefined && typeof _default !== 'boolean') throw new Error(`Bad ${name}.default: ${_default}`);
    return profile as Profile;
}
