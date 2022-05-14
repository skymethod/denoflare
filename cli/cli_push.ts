import { loadConfig, resolveBindings, resolveProfile } from './config_loader.ts';
import { gzip, isAbsolute, resolve, fromFileUrl, relative } from './deps_cli.ts';
import { putScript, Binding as ApiBinding, listDurableObjectsNamespaces, createDurableObjectsNamespace, updateDurableObjectsNamespace, Part, Migrations, CloudflareApi, listZones, Zone, putWorkersDomain } from '../common/cloudflare_api.ts';
import { CLI_VERSION } from './cli_version.ts';
import { Bytes } from '../common/bytes.ts';
import { isValidScriptName } from '../common/config_validation.ts';
import { computeContentsForScriptReference, parseOptionalStringOptions } from './cli_common.ts';
import { Script, Binding, isTextBinding, isSecretBinding, isKVNamespaceBinding, isDONamespaceBinding, isWasmModuleBinding, isServiceBinding, isR2Binding } from '../common/config.ts';
import { ModuleWatcher } from './module_watcher.ts';
import { checkEqual, checkMatchesReturnMatcher } from '../common/check.ts';
import { emit } from './emit.ts';

export async function push(args: (string | number)[], options: Record<string, unknown>) {
    const scriptSpec = args[0];
    if (options.help || typeof scriptSpec !== 'string') {
        dumpHelp();
        return;
    }
    const verbose = !!options.verbose;
    if (verbose) {
        // in cli
        ModuleWatcher.VERBOSE = verbose;
        CloudflareApi.DEBUG = true;
    }

    const nameFromOptions = typeof options.name === 'string' && options.name.trim().length > 0 ? options.name.trim() : undefined;

    const config = await loadConfig(options);
    const { scriptName, rootSpecifier, script } = await computeContentsForScriptReference(scriptSpec, config, nameFromOptions);
    if (!isValidScriptName(scriptName)) throw new Error(`Bad scriptName: ${scriptName}`);
    const { accountId, apiToken } = await resolveProfile(config, options);
    const watch = !!options.watch;
    const watchIncludes = typeof options.watch === 'string' ? options.watch.split(',').map(v => v.trim()) : [];
    const customDomainsFromOptions = parseOptionalStringOptions('custom-domain', options);

    const pushStart = new Date().toISOString().substring(0, 19) + 'Z';
    let pushNumber = 1;
    const buildAndPutScript = async () => {
        const isModule = !rootSpecifier.endsWith('.js');
        let scriptContentsStr = '';
        if (isModule) {
            console.log(`bundling ${scriptName} into bundle.js...`);
            const start = Date.now();
            scriptContentsStr = await emit(rootSpecifier);
            console.log(`bundle finished in ${Date.now() - start}ms`);
        } else {
            scriptContentsStr = await Deno.readTextFile(rootSpecifier);
        }

        let start = Date.now();
        const doNamespaces = new DurableObjectNamespaces(accountId, apiToken);
        const pushId = watch ? `${pushStart}.${pushNumber}` : undefined;
        const pushIdSuffix = pushId ? ` ${pushId}` : '';
        const usageModel = script?.usageModel;
        const { bindings, parts } = script ? await computeBindings(script, scriptName, doNamespaces, pushId) : { bindings: [], parts: [] };
        const enableR2 = bindings.some(v => v.type === 'r2_bucket');
        console.log(`computed bindings in ${Date.now() - start}ms`);

        // only perform migrations on first upload, not on subsequent --watch uploads
        const migrations = pushNumber === 1 ? computeMigrations(options) : undefined;

        if (isModule) {
            scriptContentsStr = await rewriteScriptContents(scriptContentsStr, rootSpecifier, parts);
        }
        const scriptContents = new TextEncoder().encode(scriptContentsStr);
        const compressedScriptContents = gzip(scriptContents);

        console.log(`putting ${isModule ? 'module' : 'script'}-based ${usageModel ? `${usageModel} worker` : 'worker' } ${scriptName}${pushIdSuffix}... ${computeSizeString(scriptContents, compressedScriptContents, parts)}`);
        if (migrations && migrations.deleted_classes.length > 0) {
            console.log(`  migration will delete durable object class(es): ${migrations.deleted_classes.join(', ')}`);
        }
        start = Date.now();

        await putScript(accountId, scriptName, apiToken, { scriptContents, bindings, migrations, parts, isModule, usageModel, enableR2 });
        console.log(`put script ${scriptName}${pushIdSuffix} in ${Date.now() - start}ms`);
       
        if (doNamespaces.hasPendingUpdates()) {
            start = Date.now();
            await doNamespaces.flushPendingUpdates();
            console.log(`updated durable object namespaces in ${Date.now() - start}ms`);
        }

        // only perform custom domain setup on first upload, not on subsequent --watch uploads
        if (pushNumber === 1) {
            const customDomains = customDomainsFromOptions || script?.customDomains || [];
            if (customDomains.length > 0) {
                start = Date.now();
                const zones = await listZones(accountId, apiToken, { perPage: 1000 });
                for (const customDomain of customDomains) {
                    await ensureCustomDomainExists(customDomain, { zones, scriptName, accountId, apiToken });
                }
                console.log(`bound worker to ${customDomains.length === 1 ? 'custom domain' : `${customDomains.length} custom domains`} in ${Date.now() - start}ms`);
            }
        }
        
        pushNumber++;
    }
    await buildAndPutScript();

    if (watch) {
        console.log('watching for changes...');
        const scriptUrl = rootSpecifier.startsWith('https://') ? new URL(rootSpecifier) : undefined;
        if (scriptUrl && !scriptUrl.pathname.endsWith('.ts')) throw new Error('Url-based module workers must end in .ts');
        const scriptPathOrUrl = scriptUrl ? scriptUrl.toString() : script ? script.path : isAbsolute(rootSpecifier) ? rootSpecifier : resolve(Deno.cwd(), rootSpecifier);
        const _moduleWatcher = new ModuleWatcher(scriptPathOrUrl, async () => {
            try {
                await buildAndPutScript();
            } catch (e) {
                console.error(e);
            } finally {
                console.log('watching for changes...');
            }
        }, watchIncludes);
        return new Promise(() => {});
    }
}

//

async function ensureCustomDomainExists(customDomain: string, opts: { zones: readonly Zone[], scriptName: string, accountId: string, apiToken: string }) {
    const { zones, scriptName, accountId, apiToken } = opts;
    console.log(`ensuring ${customDomain} points to ${scriptName}...`);
    const zoneCandidates = zones.filter(v => customDomain.endsWith('.' + v.name));
    if (zoneCandidates.length === 0) throw new Error(`Unable to locate the parent zone, do you have permissions to edit zones?`);
    if (zoneCandidates.length > 1) throw new Error(`Unable to locate the parent zone, multiple candidates: ${zoneCandidates.map(v => v.name).join(', ')}`);
    const [ zone ] = zoneCandidates;
    checkEqual('zone.paused', zone.paused, false);
    checkEqual('zone.status', zone.status, 'active');
    checkEqual('zone.type', zone.type, 'full');

    // idempotent
    await putWorkersDomain(accountId, apiToken, { hostname: customDomain, zoneId: zone.id, service: scriptName, environment: 'production' });
}

function computeMigrations(options: Record<string, unknown>): Migrations | undefined {
    const option = options['delete-class'];
    const deleted_classes = typeof option === 'string' ? [ option ] : Array.isArray(option) && option.every(v => typeof v === 'string') ? option as string[] : [];
    return deleted_classes.length > 0 ? { tag: `delete-${deleted_classes.join('-')}`, deleted_classes } : undefined;
}

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
    const p = /const\s+([a-zA-Z0-9_]+)\s*=\s*await\s+import(Wasm|Text|Binary)\d*\(\s*(importMeta\d*)\.url\s*,\s*'((https:\/|\.)\/[\/.a-zA-Z0-9_-]+)'\s*\)\s*;?/g;
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
        const unquotedModuleSpecifier = m[4];

        const importMetaUrl = findImportMetaUrl(importMetaVariableName, scriptContents);
        const { relativePath, valueBytes, valueType } = await resolveImport({ importType, importMetaUrl, unquotedModuleSpecifier, rootSpecifier });
        const value = new Blob([ valueBytes ], { type: valueType });
        parts.push({ name: relativePath, fileName: relativePath, value, valueBytes });
        pieces.push(`import ${variableName} from ${'"'}${relativePath}";`);
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
        const relativePath = relative(rootSpecifierDir, localPath);
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
    } else if (isServiceBinding(binding)) {
        const [ _, service, environment ] = checkMatchesReturnMatcher('serviceEnvironment', binding.serviceEnvironment, /^(.*?):(.*?)$/);
        return { type: 'service', name, service, environment };
    } else if (isR2Binding(binding)) {
        return { type: 'r2_bucket', name, bucket_name: binding.bucketName };
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
        '    -n, --name <name>          Name to use for Cloudflare Worker script [default: Name of script defined in .denoflare config, or https url basename sans extension]',
        '        --profile <name>       Name of profile to load from config (default: only profile or default profile in config)',
        '        --config <path>        Path to config file (default: .denoflare in cwd or parents)',
        '        --delete-class <name>  Delete an obsolete Durable Object (and all data!) by class name',
        '',
        'ARGS:',
        '    <script-spec>    Name of script defined in .denoflare config, file path to bundled js worker, or an https url to a module-based worker .ts, e.g. https://path/to/worker.ts',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
