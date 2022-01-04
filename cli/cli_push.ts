import { loadConfig, resolveBindings, resolveProfile } from './config_loader.ts';
import { gzip, isAbsolute, resolve, fromFileUrl, relative } from './deps_cli.ts';
import { putScript, Binding as ApiBinding, listDurableObjectsNamespaces, createDurableObjectsNamespace, updateDurableObjectsNamespace, Part } from '../common/cloudflare_api.ts';
import { CLI_VERSION } from './cli_version.ts';
import { Bytes } from '../common/bytes.ts';
import { isValidScriptName } from '../common/config_validation.ts';
import { computeContentsForScriptReference } from './cli_common.ts';
import { Script, Binding, isTextBinding, isSecretBinding, isKVNamespaceBinding, isDONamespaceBinding, isWasmModuleBinding } from '../common/config.ts';
import { ModuleWatcher } from './module_watcher.ts';

export async function push(args: (string | number)[], options: Record<string, unknown>) {
    const scriptSpec = args[0];
    if (options.help || typeof scriptSpec !== 'string') {
        dumpHelp();
        return;
    }
    const nameFromOptions = typeof options.name === 'string' && options.name.trim().length > 0 ? options.name.trim() : undefined;

    const config = await loadConfig(options);
    const { scriptName, rootSpecifier, script } = await computeContentsForScriptReference(scriptSpec, config, nameFromOptions);
    if (!isValidScriptName(scriptName)) throw new Error(`Bad scriptName: ${scriptName}`);
    const { accountId, apiToken } = await resolveProfile(config, options);
    const watch = !!options.watch;

    let pushNumber = 1;

    const buildAndPutScript = async () => {
        const isModule = !rootSpecifier.endsWith('.js');
        let scriptContentsStr = '';
        if (isModule) {
            console.log(`bundling ${scriptName} into bundle.js...`);
            const start = Date.now();
            const result = await Deno.emit(rootSpecifier, { 
                bundle: 'module', 
            });
            console.log(`bundle finished in ${Date.now() - start}ms`);

            if (result.diagnostics.length > 0) {
                console.warn(Deno.formatDiagnostics(result.diagnostics));
                throw new Error('bundle failed');
            }
            scriptContentsStr = result.files['deno:///bundle.js'];
            if (typeof scriptContentsStr !== 'string') throw new Error(`bundle.js not found in bundle output files: ${Object.keys(result.files).join(', ')}`);
        } else {
            scriptContentsStr = await Deno.readTextFile(rootSpecifier);
        }

        let start = Date.now();
        const doNamespaces = new DurableObjectNamespaces(accountId, apiToken);
        const pushId = watch ? `${pushNumber++}` : undefined;
        const pushIdSuffix = pushId ? ` ${pushId}` : '';
        const { bindings, parts } = script ? await computeBindings(script, scriptName, doNamespaces, pushId) : { bindings: [], parts: [] };
        console.log(`computed bindings in ${Date.now() - start}ms`);
        
        if (isModule) {
            scriptContentsStr = await rewriteScriptContents(scriptContentsStr, rootSpecifier, parts);
        }
        const scriptContents = new TextEncoder().encode(scriptContentsStr);
        const compressedScriptContents = gzip(scriptContents);

        console.log(`putting ${isModule ? 'module' : 'script'}-based worker ${scriptName}${pushIdSuffix}... ${computeSizeString(scriptContents, compressedScriptContents, parts)}`);
        start = Date.now();

        await putScript(accountId, scriptName, scriptContents, bindings, parts, apiToken, isModule);
        console.log(`put script ${scriptName}${pushIdSuffix} in ${Date.now() - start}ms`);
        if (doNamespaces.hasPendingUpdates()) {
            start = Date.now();
            await doNamespaces.flushPendingUpdates();
            console.log(`updated durable object namespaces in ${Date.now() - start}ms`);
        }
    }
    await buildAndPutScript();

    if (watch) {
        console.log('Watching for changes...');
        const scriptUrl = rootSpecifier.startsWith('https://') ? new URL(rootSpecifier) : undefined;
        if (scriptUrl && !scriptUrl.pathname.endsWith('.ts')) throw new Error('Url-based module workers must end in .ts');
        const scriptPathOrUrl = scriptUrl ? scriptUrl.toString() : script ? script.path : isAbsolute(rootSpecifier) ? rootSpecifier : resolve(Deno.cwd(), rootSpecifier);
        const _moduleWatcher = new ModuleWatcher(scriptPathOrUrl, async () => {
            try {
                await buildAndPutScript();
            } catch (e) {
                console.error(e);
            } finally {
                console.log('Watching for changes...');
            }
        });
        return new Promise(() => {});
    }
}

//

function computeSizeString(scriptContents: Uint8Array, compressedScriptContents: Uint8Array, parts: Part[]): string {
    let uncompressedSize = scriptContents.length;
    let compressedSize = compressedScriptContents.length;
    for (const { name, valueBytes } of parts) {
        if (!valueBytes) throw new Error(`Unable to compute size for part: ${name}`);
        uncompressedSize += valueBytes.length;
        const compressedValueBytes = gzip(valueBytes);
        compressedSize += compressedValueBytes.length;
    }
    return `(${Bytes.formatSize(uncompressedSize)}) (${Bytes.formatSize(compressedSize)} compressed)`;
}

async function rewriteScriptContents(scriptContents: string, rootSpecifier: string, parts: Part[]): Promise<string> {
    const p = /const\s+([a-zA-Z0-9]+)\s*=\s*await\s+importWasm\d*\(\s*(importMeta\d*)\.url\s*,\s*'((https:\/|\.)\/[\/.a-zA-Z0-9-]+)'\s*\)\s*;?/g;
    let m: RegExpExecArray | null;
    let i = 0;
    const pieces = [];
    while((m = p.exec(scriptContents)) !== null) {
        const { index } = m;
        pieces.push(scriptContents.substring(i, index));
        const line = m[0];
        const variableName = m[1];
        const importMetaVariableName = m[2];
        const unquotedModuleSpecifier = m[3];

        const importMetaUrl = findImportMetaUrl(importMetaVariableName, scriptContents);
        const { relativeWasmPath, valueBytes } = await resolveWasm({ importMetaUrl, unquotedModuleSpecifier, rootSpecifier });
        const value = new Blob([ valueBytes ], { type: 'application/wasm' });
        parts.push({ name: relativeWasmPath, fileName: relativeWasmPath, value, valueBytes });
        pieces.push(`import ${variableName} from "${relativeWasmPath}";`);
        i = index + line.length;
    }
    if (pieces.length === 0) return scriptContents;

    pieces.push(scriptContents.substring(i));
    return pieces.join('');
}

function findImportMetaUrl(importMetaVariableName: string, scriptContents: string): string {
    const m = new RegExp(`.*const ${importMetaVariableName} = {\\s*url: "((file|https):.*?)".*`, 's').exec(scriptContents);
    if (!m) throw new Error(`findImportMetaUrl: Unable to find importMetaVariableName ${importMetaVariableName}`);
    return m[1];
}

async function resolveWasm(opts: { importMetaUrl: string, unquotedModuleSpecifier: string, rootSpecifier: string }): Promise<{ relativeWasmPath: string, valueBytes: Uint8Array }> {
    const { importMetaUrl, unquotedModuleSpecifier, rootSpecifier } = opts;
    
    const fetchWasm = async (wasmUrl: string) => {
        console.log(`resolveWasm: Fetching ${wasmUrl}`);
        const res = await fetch(wasmUrl);
        if (res.status !== 200) throw new Error(`Bad status ${res.status}, expected 200 for ${wasmUrl}`);
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        const allowedContentTypes = ['application/wasm', 'application/octet-stream'];
        if (!allowedContentTypes.includes(contentType)) throw new Error(`Bad content-type ${contentType}, expected ${allowedContentTypes.join(' or ')} for ${wasmUrl}`);
        const valueBytes = new Uint8Array(await res.arrayBuffer());
        const relativeWasmPath = 'https/' + wasmUrl.substring('https://'.length);
        return { relativeWasmPath, valueBytes };
    }
    if (unquotedModuleSpecifier.startsWith('https://')) {
        return await fetchWasm(unquotedModuleSpecifier);
    }
    if (importMetaUrl.startsWith('file://')) {
        const wasmPath = resolve(resolve(fromFileUrl(importMetaUrl), '..'), unquotedModuleSpecifier);
        const rootSpecifierDir = resolve(rootSpecifier, '..');
        const relativeWasmPath = relative(rootSpecifierDir, wasmPath);
        const valueBytes = await Deno.readFile(wasmPath);
        return { relativeWasmPath, valueBytes };
    } else if (importMetaUrl.startsWith('https://')) {
        const { pathname, origin } = new URL(importMetaUrl);
        const wasmUrl = origin + resolve(resolve(pathname, '..'), unquotedModuleSpecifier);
        return await fetchWasm(wasmUrl);
    } else {
        throw new Error(`resolveWasm: Unsupported importMetaUrl: ${importMetaUrl}`);
    }
}

//

class DurableObjectNamespaces {
    private readonly accountId: string;
    private readonly apiToken: string;

    private readonly pendingUpdates: { id: string, name?: string, script?: string, class?: string }[] = [];

    constructor(accountId: string, apiToken: string) {
        this.accountId = accountId;
        this.apiToken = apiToken;
    }

    async getOrCreateNamespaceId(namespaceSpec: string, scriptName: string): Promise<string> {
        const tokens = namespaceSpec.split(':');
        if (tokens.length !== 2) throw new Error(`Bad durable object namespace spec: ${namespaceSpec}`);
        const name = tokens[0];
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error(`Bad durable object namespace name: ${name}`);
        const className = tokens[1];
        const namespaces = await listDurableObjectsNamespaces(this.accountId, this.apiToken);
        let namespace = namespaces.find(v => v.name === name);
        if (!namespace)  {
            console.log(`Creating new durable object namespace: ${name}`);
            namespace = await createDurableObjectsNamespace(this.accountId, this.apiToken, { name });
        }
        if (namespace.class !== className || namespace.script !== scriptName) {
            this.pendingUpdates.push({ id: namespace.id, name, script: scriptName, class: className });
        }
        return namespace.id;
    }

    hasPendingUpdates() {
        return this.pendingUpdates.length > 0;
    }

    async flushPendingUpdates() {
        for (const payload of this.pendingUpdates) {
            console.log(`Updating durable object namespace ${payload.name}: script=${payload.script}, class=${payload.class}`);
            await updateDurableObjectsNamespace(this.accountId, this.apiToken, payload);
        }
        this.pendingUpdates.splice(0);
    }
}

//

async function computeBindings(script: Script, scriptName: string, doNamespaces: DurableObjectNamespaces, pushId: string | undefined): Promise<{ bindings: ApiBinding[], parts: Part[] }> {
    const resolvedBindings = await resolveBindings(script.bindings || {}, undefined, pushId);
    const bindings: ApiBinding[] = [];
    const partsMap: Record<string, Part> = {};
    for (const [name, binding] of Object.entries(resolvedBindings)) {
        bindings.push(await computeBinding(name, binding, doNamespaces, scriptName, partsMap));
    }
    return { bindings, parts: Object.values(partsMap) };
}

async function computeBinding(name: string, binding: Binding, doNamespaces: DurableObjectNamespaces, scriptName: string, parts: Record<string, Part>): Promise<ApiBinding> {
    if (isTextBinding(binding)) {
        return { type: 'plain_text', name, text: binding.value };
    } else if (isSecretBinding(binding)) {
        return { type: 'secret_text', name, text: binding.secret };
    } else if (isKVNamespaceBinding(binding)) {
        return { type: 'kv_namespace', name, namespace_id: binding.kvNamespace };
    } else if (isDONamespaceBinding(binding)) {
        return { type: 'durable_object_namespace', name, namespace_id: await doNamespaces.getOrCreateNamespaceId(binding.doNamespace, scriptName) };
    } else if (isWasmModuleBinding(binding)) {
        return { type: 'wasm_module', name, part: await computeWasmModulePart(binding.wasmModule, parts, name) };
    } else {
        throw new Error(`Unsupported binding ${name}: ${binding}`);
    }
}

async function computeWasmModulePart(wasmModule: string, parts: Record<string, Part>, name: string): Promise<string> {
    const valueBytes = await Deno.readFile(wasmModule);
    const part = name;
    parts[part] = { name, value: new Blob([ valueBytes ], { type: 'application/wasm' }), valueBytes };
    return part;
}

function dumpHelp() {
    const lines = [
        `denoflare-push ${CLI_VERSION}`,
        'Upload a worker script to Cloudflare Workers',
        '',
        'USAGE:',
        '    denoflare push [FLAGS] [OPTIONS] [--] [script-spec]',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '        --watch       Re-upload the worker script when local changes are detected',
        '',
        'OPTIONS:',
        '    -n, --name <name>        Name to use for Cloudflare Worker script [default: Name of script defined in .denoflare config, or https url basename sans extension]',
        '        --profile <name>     Name of profile to load from config (default: only profile or default profile in config)',
        '        --config <path>      Path to config file (default: .denoflare in cwd or parents)',
        '',
        'ARGS:',
        '    <script-spec>    Name of script defined in .denoflare config, file path to bundled js worker, or an https url to a module-based worker .ts, e.g. https://path/to/worker.ts',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
