import { Config, Script } from '../common/config.ts';
import { isValidScriptName } from '../common/config_validation.ts';
import { basename, extname } from './deps_cli.ts';
import { fileExists } from './fs_util.ts';

const launchTime = Date.now();

export class CliStats {
    static readonly launchTime = launchTime;
}

export async function computeContentsForScriptReference(scriptSpec: string, config: Config, nameFromOptions?: string): Promise<{ scriptName: string, rootSpecifier: string, script?: Script }> {
    if (isValidScriptName(scriptSpec)) {
        const script = config.scripts && config.scripts[scriptSpec];
        if (script === undefined) throw new Error(`Script '${scriptSpec}' not found in config`);
        const scriptName = nameFromOptions || scriptSpec;
        const rootSpecifier = script.path;
        return { scriptName, rootSpecifier, script };
    } else if (scriptSpec.startsWith('https://') || await fileExists(scriptSpec)) {
        const scriptName = nameFromOptions || computeScriptNameFromPath(scriptSpec);
        const rootSpecifier = scriptSpec;
        return { scriptName, rootSpecifier };
    } else {
        throw new Error(`Bad scriptSpec: not a valid script name or file path or https url: ${scriptSpec}`);
    }
}

export function parseOptionalStringOption(name: string, options: Record<string, unknown>): string | undefined {
    const value = options[name];
    if (value === undefined || typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    throw new Error(`Bad ${name}: ${value}`);
}

export function parseOptionalBooleanOption(name: string, options: Record<string, unknown>): boolean | undefined {
    const value = options[name];
    if (value === undefined || typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`Bad ${name}: ${value}`);
}

export function parseOptionalIntegerOption(name: string, options: Record<string, unknown>): number | undefined {
    const value = options[name];
    if (value === undefined) return undefined;
    if (typeof value === 'number' && value === Math.round(value)) return value;
    throw new Error(`Bad ${name}: ${value}`);
}

export function parseNameValuePairsOption(option: string, options: Record<string, unknown>): Record<string, string> | undefined {
    const optionValue = options[option];
    if (optionValue === undefined) return undefined;
    const rt: Record<string, string> = {};
    if (typeof optionValue === 'string')  {
        const { name, value } = parseNameValue(optionValue);
        rt[name] = value;
        return rt;
    } else if (Array.isArray(optionValue) && optionValue.every(v => typeof v === 'string')) {
        for (const item of optionValue) {
            const { name, value } = parseNameValue(item);
            rt[name] = value;
        }
        return rt;
    } else {
        throw new Error(`Bad ${option}: ${optionValue}`);
    }
}

//

function computeScriptNameFromPath(path: string) {
    const base = basename(path);
    const ext = extname(path);
    return base.endsWith(ext) ? base.substring(0, base.length - ext.length) : base;
}

function parseNameValue(str: string): { name: string, value: string} {
    const i = str.indexOf('=');
    if (i < 0) throw new Error(`Bad name value: ${str}`);
    const name = str.substring(0, i);
    const value = str.substring(i + 1);
    return { name, value };
}
