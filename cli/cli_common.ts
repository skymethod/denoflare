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

//

function computeScriptNameFromPath(path: string) {
    const base = basename(path);
    const ext = extname(path);
    return base.endsWith(ext) ? base.substring(0, base.length - ext.length) : base;
}
