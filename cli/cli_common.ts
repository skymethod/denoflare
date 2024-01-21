import { Bytes } from '../common/bytes.ts';
import { checkMatchesReturnMatcher } from '../common/check.ts';
import { Binding, Config, Script } from '../common/config.ts';
import { isValidScriptName } from '../common/config_validation.ts';
import { CliCommand } from './cli_command.ts';
import { CLI_VERSION } from './cli_version.ts';
import { basename, extname, dirname, resolve, fromFileUrl, relative, systemSeparator } from './deps_cli.ts';
import { fileExists } from './fs_util.ts';

const launchTime = Date.now();

export const CLI_USER_AGENT = `denoflare-cli/${CLI_VERSION}`;
export class CliStats {
    static readonly launchTime = launchTime;
}

export function denoflareCliCommand(command: string | string[], description: string) {
    const commandArr = typeof command === 'string' ? [ command ] : command;
    return CliCommand.of(['denoflare', ...commandArr], description, { version: CLI_VERSION });
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

export function parseRequiredStringOption(name: string, options: Record<string, unknown>): string {
    const rt = parseOptionalStringOption(name, options);
    if (rt === undefined) throw Error(`Missing required option: ${name}`);
    return rt;
}

export function parseOptionalStringOption(name: string, options: Record<string, unknown>): string | undefined {
    const value = options[name];
    if (value === undefined || typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    throw new Error(`Bad ${name}: ${value}`);
}

export function parseOptionalStringOptions(name: string, options: Record<string, unknown>): string[] | undefined {
    const value = options[name];
    if (value === undefined) return undefined;
    if (typeof value === 'string') return [ value ];
    if (Array.isArray(value) && value.every(v => typeof v === 'string')) return value;
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

export function commandOptionsForInputBindings(command: CliCommand<unknown>) {
    return command
        .optionGroup()
        .option('textBinding', 'strings', 'Plain text environment variable binding, overrides config', { hint: 'name:plain-text'})
        .option('secretBinding', 'strings', 'Secret text environment variable binding, overrides config', { hint: 'name:secret-text'})
        .option('kvNamespaceBinding', 'strings', 'KV namespace environment variable binding, overrides config', { hint: 'name:namespace-id'})
        .option('doNamespaceBinding', 'strings', 'DO namespace environment variable binding, overrides config', { hint: 'name:namespace-name:class-name'})
        .option('wasmModuleBinding', 'strings', 'Wasm module environment variable binding, overrides config', { hint: 'name:path-to-local-wasm-file'})
        .option('serviceBinding', 'strings', 'Service environment variable binding, overrides config', { hint: 'name:service:environment'})
        .option('r2BucketBinding', 'strings', 'R2 bucket environment variable binding, overrides config', { hint: 'name:bucket-name'})
        .option('aeDatasetBinding', 'strings', 'Analytics Engine dataset environment variable binding, overrides config', { hint: 'name:dataset-name'})
        .option('queueBinding', 'strings', 'Queue environment variable binding, overrides config', { hint: 'name:queue-name'})
        .option('secretKeyBinding', 'strings', 'Secret key environment variable binding, overrides config', { hint: 'name:{"algorithm":{"name":"HMAC"...'})
        ;
}

export function parseInputBindingsFromOptions(options: Record<string, unknown>): Record<string, Binding> {
    const rt: Record<string, Binding> = {};
    const pattern = /^([^:]+):(.*)$/;
    for (const textBinding of parseOptionalStringOptions('text-binding', options) || []) {
        const [ _, name, value ] = checkMatchesReturnMatcher('text-binding', textBinding, pattern);
        rt[name] = { value };
    }
    for (const secretBinding of parseOptionalStringOptions('secret-binding', options) || []) {
        const [ _, name, secret ] = checkMatchesReturnMatcher('secret-binding', secretBinding, pattern);
        rt[name] = { secret };
    }
    for (const kvNamespaceBinding of parseOptionalStringOptions('kv-namespace-binding', options) || []) {
        const [ _, name, kvNamespace ] = checkMatchesReturnMatcher('kv-namespace-binding', kvNamespaceBinding, pattern);
        rt[name] = { kvNamespace };
    }
    for (const doNamespaceBinding of parseOptionalStringOptions('do-namespace-binding', options) || []) {
        const [ _, name, doNamespace ] = checkMatchesReturnMatcher('do-namespace-binding', doNamespaceBinding, pattern);
        rt[name] = { doNamespace };
    }
    for (const wasmModuleBinding of parseOptionalStringOptions('wasm-module-binding', options) || []) {
        const [ _, name, wasmModule ] = checkMatchesReturnMatcher('wasm-module-binding', wasmModuleBinding, pattern);
        rt[name] = { wasmModule };
    }
    for (const serviceBinding of parseOptionalStringOptions('service-binding', options) || []) {
        const [ _, name, serviceEnvironment ] = checkMatchesReturnMatcher('service-binding', serviceBinding, pattern);
        rt[name] = { serviceEnvironment };
    }
    for (const r2BucketBinding of parseOptionalStringOptions('r2-bucket-binding', options) || []) {
        const [ _, name, bucketName ] = checkMatchesReturnMatcher('r2-bucket-binding', r2BucketBinding, pattern);
        rt[name] = { bucketName };
    }
    for (const aeDatasetBinding of parseOptionalStringOptions('ae-dataset-binding', options) || []) {
        const [ _, name, dataset ] = checkMatchesReturnMatcher('ae-dataset-binding', aeDatasetBinding, pattern);
        rt[name] = { dataset };
    }
    for (const queueBinding of parseOptionalStringOptions('queue-binding', options) || []) {
        const [ _, name, queueName ] = checkMatchesReturnMatcher('queue-binding', queueBinding, pattern);
        rt[name] = { queueName };
    }
    for (const secretKeyBinding of parseOptionalStringOptions('secret-key-binding', options) || []) {
        const [ _, name, secretKey ] = checkMatchesReturnMatcher('secret-key-binding', secretKeyBinding, pattern);
        rt[name] = { secretKey };
    }
    for (const hyperdriveBinding of parseOptionalStringOptions('hyperdrive-binding', options) || []) {
        const [ _, name, hyperdrive ] = checkMatchesReturnMatcher('hyperdrive-binding', hyperdriveBinding, pattern);
        rt[name] = { hyperdrive };
    }
    return rt;
}

export type ReplacerOpts = { line: string, variableName: string, importMetaVariableName: string, unquotedModuleSpecifier: string, relativePath: string, value: Blob, valueBytes: Uint8Array };

export async function replaceImports(scriptContents: string, rootSpecifier: string, replacer: (opts: ReplacerOpts) => Promise<string> | string) : Promise<string> {
    const p = /const\s+([a-zA-Z0-9_]+)\s*=\s*await\s+import(Wasm|Text|Binary)\d*\(\s*(importMeta\d*)\.url\s*,\s*(['"`])((https:\/|\.|\.\.)\/[\/.a-zA-Z0-9_@-]+)\4\s*\)\s*;?/g;
    let m: RegExpExecArray | null;
    let i = 0;
    const pieces = [];
    while((m = p.exec(scriptContents)) !== null) {
        const { index } = m;
        pieces.push(scriptContents.substring(i, index));
        const line = m[0];
        const variableName = m[1];
        const importType = m[2];
        const importMetaVariableName = m[3];
        const unquotedModuleSpecifier = m[5];

        const importMetaUrl = findImportMetaUrl(importMetaVariableName, scriptContents);
        const { relativePath, valueBytes, valueType } = await resolveImport({ importType, importMetaUrl, unquotedModuleSpecifier, rootSpecifier });
        const value = new Blob([ valueBytes ], { type: valueType });
        const newPiece = await replacer({ line, variableName, importMetaVariableName, unquotedModuleSpecifier, relativePath, value, valueBytes });
        pieces.push(newPiece);
        i = index + line.length;
    }
    if (pieces.length === 0) return scriptContents;

    pieces.push(scriptContents.substring(i));
    return pieces.join('');
}

// Useful deployment packaging helper for Deno runtimes with a read-allowed filesystem (e.g. like Deploy, Lambda, not Supabase)

export type FileEntry = { size: number, bytes: Uint8Array, gitSha1: string };

export class ContentBasedFileBasedImports {

    readonly allFiles = new Map<string, FileEntry>();

    async addFile(name: string, bytes: Bytes) {
        this.allFiles.set(name, { size: bytes.length, bytes: bytes.array(), gitSha1: await bytes.gitSha1Hex() });
    }

    async rewriteScriptContents(scriptContents: string, rootSpecifier: string): Promise<string> {
        const { allFiles } = this;
        return await replaceImports(scriptContents, rootSpecifier, async ({ valueBytes: bytes, line, importMetaVariableName, unquotedModuleSpecifier }) => {
            const gitSha1 = await new Bytes(bytes).gitSha1Hex();
            const size = bytes.length;
            const filename = `_import_${gitSha1}.dat`;
            allFiles.set(filename, { bytes, gitSha1, size });
            return line.replace(importMetaVariableName, 'import.meta').replace(unquotedModuleSpecifier, `./${filename}`);
        });
    }

}

//

function computeScriptNameFromPath(path: string) {
    const compute = (p: string) => {
        const base = basename(p);
        const ext = extname(p);
        return base.endsWith(ext) ? base.substring(0, base.length - ext.length) : base;
    };
    let rt = compute(path);
    if (/^(worker|index|mod)$/.test(rt)) {
        let dir = dirname(path);
        if (dir === '.' || dir === '..') dir = resolve(Deno.cwd(), dir);
        rt = compute(dir);
    }
    return rt;
}

function parseNameValue(str: string): { name: string, value: string} {
    const i = str.indexOf('=');
    if (i < 0) throw new Error(`Bad name value: ${str}`);
    const name = str.substring(0, i);
    const value = str.substring(i + 1);
    return { name, value };
}

function findImportMetaUrl(importMetaVariableName: string, scriptContents: string): string {
    const m = new RegExp(`.*const ${importMetaVariableName} = {\\s*url: "((file|https):.*?)".*`, 's').exec(scriptContents);
    if (!m) throw new Error(`findImportMetaUrl: Unable to find importMetaVariableName ${importMetaVariableName}`);
    return m[1];
}

async function resolveImport(opts: { importType: string, importMetaUrl: string, unquotedModuleSpecifier: string, rootSpecifier: string }): Promise<{ relativePath: string, valueBytes: Uint8Array, valueType: string }> {
    const { importType, importMetaUrl, unquotedModuleSpecifier, rootSpecifier } = opts;
    const tag = `resolveImport${importType}`;
    const valueType = importType === 'Wasm' ? 'application/wasm'
        : importType === 'Text' ? 'text/plain'
        : 'application/octet-stream';
    const isExpectedContentType: (contentType: string) => boolean =
        importType === 'Wasm' ? (v => ['application/wasm', 'application/octet-stream'].includes(v))
        : importType === 'Text' ? (v => v.startsWith('text/'))
        : (_ => true);
    const fetchContents = async (url: string) => {
        console.log(`${tag}: Fetching ${url}`);
        const res = await fetch(url);
        if (res.status !== 200) throw new Error(`Bad status ${res.status}, expected 200 for ${url}`);
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (!isExpectedContentType(contentType)) throw new Error(`${tag}: Unexpected content-type ${contentType} for ${url}`);
        const valueBytes = new Uint8Array(await res.arrayBuffer());
        const relativePath = 'https/' + url.substring('https://'.length);
        return { relativePath, valueBytes, valueType };
    }
    if (unquotedModuleSpecifier.startsWith('https://')) {
        return await fetchContents(unquotedModuleSpecifier);
    }
    if (importMetaUrl.startsWith('file://')) {
        const localPath = resolve(resolve(fromFileUrl(importMetaUrl), '..'), unquotedModuleSpecifier);
        const rootSpecifierDir = resolve(rootSpecifier, '..');
        let relativePath = relative(rootSpecifierDir, localPath);
        if (systemSeparator === '\\') relativePath = relativePath.replaceAll('\\', '/');
        const valueBytes = await Deno.readFile(localPath);
        return { relativePath, valueBytes, valueType };
    } else if (importMetaUrl.startsWith('https://')) {
        const { pathname, origin } = new URL(importMetaUrl);
        const url = origin + resolve(resolve(pathname, '..'), unquotedModuleSpecifier);
        return await fetchContents(url);
    } else {
        throw new Error(`${tag}: Unsupported importMetaUrl: ${importMetaUrl}`);
    }
}
