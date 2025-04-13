import { commandOptionsForConfig, loadConfig, resolveBindings, resolveProfile } from './config_loader.ts';
import { gzip, isAbsolute, resolve } from './deps_cli.ts';
import { putScript, Binding as ApiBinding, listDurableObjectsNamespaces, createDurableObjectsNamespace, updateDurableObjectsNamespace, Part, Migrations, CloudflareApi, listZones, Zone, putWorkersDomain, getWorkerServiceSubdomainEnabled, setWorkerServiceSubdomainEnabled, getWorkersSubdomain, putScriptVersion, PutScriptOpts, Observability, listCloudchamberApplications, createCloudchamberApplication, CloudchamberApplicationBase, CLOUDFLARE_MANAGED_REGISTRY, CloudchamberDisk, ByteUnits } from '../common/cloudflare_api.ts';
import { Bytes } from '../common/bytes.ts';
import { isValidScriptName } from '../common/config_validation.ts';
import { commandOptionsForInputBindings, computeContentsForScriptReference, denoflareCliCommand, parseInputBindingsFromOptions, replaceImports } from './cli_common.ts';
import { Binding, isTextBinding, isSecretBinding, isKVNamespaceBinding, isDONamespaceBinding, isWasmModuleBinding, isServiceBinding, isR2BucketBinding, isAnalyticsEngineBinding, isD1DatabaseBinding, isQueueBinding, isSecretKeyBinding, isBrowserBinding, isAiBinding, isHyperdriveBinding, isVersionMetadataBinding, isSendEmailBinding, isRatelimitBinding } from '../common/config.ts';
import { ModuleWatcher } from './module_watcher.ts';
import { checkEqual, checkMatchesReturnMatcher } from '../common/check.ts';
import { commandOptionsForBundle, bundle, parseBundleOpts } from './bundle.ts';
import { parseCryptoKeyDef } from '../common/crypto_keys.ts';

export const PUSH_COMMAND = denoflareCliCommand('push', 'Upload a Cloudflare worker script to Cloudflare')
    .arg('scriptSpec', 'string', 'Name of script defined in .denoflare config, file path to bundled js worker, or an https url to a module-based worker .ts, e.g. https://path/to/worker.ts')
    .option('name', 'string', `Name to use for Cloudflare Worker script [default: Name of script defined in .denoflare config, or https url basename sans extension]`)
    .option('watch', 'boolean', 'If set, watch the local file system and automatically re-upload on script changes')
    .option('watchInclude', 'strings', 'If watching, watch this additional path as well (e.g. for dynamically-imported static resources)', { hint: 'path' })
    .option('customDomain', 'strings', 'Bind worker to one or more Custom Domains for Workers', { hint: 'domain-or-subdomain-name' })
    .option('workersDev', 'boolean', 'Enable or disable the worker workers.dev route')
    .option('logpush', 'boolean', 'Enable or disable logpush for the worker')
    .option('compatibilityDate', 'string', 'Specific compatibility environment for the worker, see https://developers.cloudflare.com/workers/platform/compatibility-dates/')
    .option('compatibilityFlag', 'strings', 'Specific compatibility flags for the worker, see https://developers.cloudflare.com/workers/platform/compatibility-dates/#compatibility-flags')
    .option('observability', 'boolean', 'Enable or disable observability for the worker')
    .option('observabilitySampleRate', 'string', 'Observability sample rate, from 0 (0%) to 1 (100%)')
    .option('deleteClass', 'strings', 'Delete an obsolete Durable Object (and all data!) by class name as part of the update', { hint: 'class-name' })
    .option('versionTag', 'string', 'If set, push a new version with this tag')
    .include(commandOptionsForInputBindings)
    .include(commandOptionsForConfig)
    .include(commandOptionsForBundle)
    .docsLink('/cli/push')
    ;

export async function push(args: (string | number)[], options: Record<string, unknown>) {
    if (PUSH_COMMAND.dumpHelp(args, options)) return;

    const opt = PUSH_COMMAND.parse(args, options);
    const { scriptSpec, verbose, name: nameOpt, customDomain: customDomainOpt, workersDev: workersDevOpt, logpush: logpushOpt, compatibilityDate: compatibilityDateOpt, compatibilityFlag: compatibilityFlagOpt, deleteClass: deleteClassOpt, watch, watchInclude, versionTag, observability: observabilityOpt, observabilitySampleRate } = opt;

    if (verbose) {
        // in cli
        ModuleWatcher.VERBOSE = verbose;
        CloudflareApi.DEBUG = true;
    }

    const config = await loadConfig(options);
    const { scriptName, rootSpecifier, script } = await computeContentsForScriptReference(scriptSpec, config, nameOpt);
    if (!isValidScriptName(scriptName)) throw new Error(`Bad scriptName: ${scriptName}`);
    const { accountId, apiToken } = await resolveProfile(config, options, script);
    const inputBindings = { ...(script?.bindings || {}), ...parseInputBindingsFromOptions(options) };
    const bundleOpts = parseBundleOpts(options);

    const pushStart = new Date().toISOString().substring(0, 19) + 'Z';
    let pushNumber = 1;
    const buildAndPutScript = async () => {
        const isModule = !rootSpecifier.endsWith('.js');
        let scriptContentsStr = '';
        if (isModule) {
            console.log(`bundling ${scriptName} into bundle.js...`);
            const start = Date.now();
            const output = await bundle(rootSpecifier, bundleOpts);
            scriptContentsStr = output.code;
            console.log(`bundle finished (${output.backend}) in ${Date.now() - start}ms`);
        } else {
            scriptContentsStr = await Deno.readTextFile(rootSpecifier);
        }

        let start = Date.now();
        const doNamespaces = new DurableObjectNamespaces(accountId, apiToken);
        const pushId = watch ? `${pushStart}.${pushNumber}` : undefined;
        const pushIdSuffix = pushId ? ` ${pushId}` : '';
        const usageModel = script?.usageModel;
        const logpush = typeof logpushOpt === 'boolean' ? logpushOpt : script?.logpush;
        const compatibilityDate = typeof compatibilityDateOpt === 'string' ? compatibilityDateOpt : script?.compatibilityDate;
        const compatibilityFlags = compatibilityFlagOpt || script?.compatibilityFlags;
        const observability: Observability | undefined = (typeof observabilityOpt === 'boolean' || typeof observabilitySampleRate === 'string') ? { enabled: observabilityOpt ?? true, head_sampling_rate: typeof observabilitySampleRate === 'string' ? parseFloat(observabilitySampleRate) : undefined } 
            : typeof script?.observability === 'boolean' ? { enabled: script.observability, head_sampling_rate: script.observabilitySampleRate }
            : undefined;
        const { bindings, parts } = await computeBindings(inputBindings, scriptName, doNamespaces, pushId);
        const containers = doNamespaces.containerClassNames.length > 0 ? doNamespaces.containerClassNames.map(v => ({ class_name: v })) : undefined;
        console.log(`computed bindings in ${Date.now() - start}ms`);

        if (containers?.length ?? 0 > 0) {
            console.log('ensuring container applications exist...');
            for (const [ namespaceId, containerSpec ] of doNamespaces.namespaceIdsToContainerSpecs) {
                const namespaceName = doNamespaces.namespaceIdsToNamespaceNames.get(namespaceId);
                if (typeof namespaceName !== 'string') throw new Error();
                const params = containerSpec.split(',').map(v => v.split('='));
                const {
                    instances: instancesParam,
                    'max-instances': maxInstancesParam,
                    image: imageParam,
                    'disk-size': diskSizeParam,
                    memory: memoryParam,
                    vcpu: vcpuParam,
                    tier: tierParam,
                    name: nameParam,
                    ...rest
                } = Object.fromEntries(params) as Record<string, string>;

                const applications = await listCloudchamberApplications({ accountId, apiToken });
                const existing = applications.find(v => v.durable_objects?.namespace_id === namespaceId);

                const instances = typeof instancesParam === 'string' ? parseInt(instancesParam) : 0;
                const max_instances = typeof maxInstancesParam === 'string' ? parseInt(maxInstancesParam) : undefined;
                const scheduling_policy = 'regional';
                let image = imageParam;
                if (typeof image !== 'string') throw new Error(`Must specific 'image' container param`);
                if (!image.includes('/')) image = `${CLOUDFLARE_MANAGED_REGISTRY}/${image}`;
                const parseByteUnits = (paramName: string, paramValue: string): ByteUnits => {
                    const upper = paramValue.toUpperCase();
                    if (!/^\d+(MB|GB)$/.test(upper)) throw new Error(`Invalid container ${paramName}: ${paramValue}`);
                    return upper as ByteUnits;
                }
                const disk = typeof diskSizeParam === 'string' ? { size: parseByteUnits('disk-size', diskSizeParam) } : undefined;
                const memory = typeof memoryParam === 'string' ? parseByteUnits('memory', memoryParam) : undefined;
                const vcpu = typeof vcpuParam === 'string' ? parseInt(vcpuParam) : undefined;
                const environment_variables = Object.entries(rest).filter(v => v[0].startsWith('env-')).map(v => ({ name: v[0].substring(4), value: v[1] }));
                const tier = typeof tierParam === 'string' ? parseInt(tierParam) : undefined;
                const getMulti = (name: string): string[] | undefined => {
                    const rt = params.filter(v => v[0] === name).map(v => v[1]);
                    return rt.length > 0 ? rt : undefined;
                }
                const regions = getMulti('region');
                const cities = getMulti('city');
                const computeAutogeneratedName = () => {
                    return `${scriptName}-${namespaceName}-${namespaceId}`;
                };
                const name = typeof nameParam === 'string' ? nameParam : computeAutogeneratedName();

                if (existing) {
                    throw new Error('TODO update!');
                } else {
                    console.log('creating new container application...')
                    const input: CloudchamberApplicationBase = {
                        name,
                        instances,
                        max_instances,
                        scheduling_policy,
                        configuration: {
                            image,
                            disk,
                            memory,
                            vcpu,
                            environment_variables,
                        },
                        constraints: {
                            tier,
                            regions,
                            cities,
                        },
                        durable_objects: {
                            namespace_id: namespaceId,
                        },
                    }
                    await createCloudchamberApplication({ accountId, apiToken, input });
                    console.log(`...created new container application: ${name}`);
                }
            }
        }

        // only perform migrations on first upload, not on subsequent --watch uploads
        const migrations = pushNumber === 1 ? computeMigrations(deleteClassOpt) : undefined;

        if (isModule) {
            scriptContentsStr = await rewriteScriptContents(scriptContentsStr, rootSpecifier, parts);
        }
        const scriptContents = new TextEncoder().encode(scriptContentsStr);
        const compressedScriptContents = gzip(scriptContents);

        console.log(`putting ${isModule ? 'module' : 'script'}-based ${usageModel ? `${usageModel} worker` : 'worker' } ${scriptName}${pushIdSuffix}... ${computeSizeString(scriptContents, compressedScriptContents, parts)}`);
        if (migrations && 'deleted_classes' in migrations && migrations.deleted_classes.length > 0) {
            console.log(`  migration will delete durable object class(es): ${migrations.deleted_classes.join(', ')}`);
        }
        start = Date.now();

        const putScriptOpts: PutScriptOpts = { accountId, scriptName, apiToken, scriptContents, bindings, migrations, parts, isModule, usageModel, logpush, compatibilityDate, compatibilityFlags, observability, containers };
        if (typeof versionTag === 'string') {
            await putScriptVersion({ ...putScriptOpts, tagAnnotation: versionTag });
        } else {
            await putScript(putScriptOpts);
        }
        
        console.log(`put script ${scriptName}${pushIdSuffix} in ${Date.now() - start}ms`);
       
        if (doNamespaces.hasPendingUpdates()) {
            start = Date.now();
            await doNamespaces.flushPendingUpdates();
            console.log(`updated durable object namespaces in ${Date.now() - start}ms`);
        }

        // only perform custom domain and/or workers dev setup on first upload, not on subsequent --watch uploads
        if (pushNumber === 1) {
            const customDomains = customDomainOpt || script?.customDomains || [];
            if (customDomains.length > 0) {
                start = Date.now();
                const zones = await listZones({ accountId, apiToken, perPage: 1000 });
                for (const customDomain of customDomains) {
                    await ensureCustomDomainExists(customDomain, { zones, scriptName, accountId, apiToken });
                }
                console.log(`bound worker to ${customDomains.length === 1 ? 'custom domain' : `${customDomains.length} custom domains`} in ${Date.now() - start}ms`);
            }
            const workersDev = typeof workersDevOpt === 'boolean' ? workersDevOpt : script?.workersDev;
            if (typeof workersDev === 'boolean') {
                start = Date.now();
                const subdomain = await getWorkersSubdomain({ accountId, apiToken });
                const enabled = await getWorkerServiceSubdomainEnabled({ accountId, apiToken, scriptName });
                if (enabled !== workersDev) {
                    await setWorkerServiceSubdomainEnabled({ accountId, apiToken, scriptName, enabled: workersDev });
                }
                console.log(`${workersDev ? 'enabled' : 'disabled'} ${scriptName}.${subdomain}.workers.dev route in ${Date.now() - start}ms`);
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
        }, watchInclude);
        return new Promise(() => {});
    }
}

//

async function ensureCustomDomainExists(customDomain: string, opts: { zones: readonly Zone[], scriptName: string, accountId: string, apiToken: string }) {
    const { zones, scriptName, accountId, apiToken } = opts;
    console.log(`ensuring ${customDomain} points to ${scriptName}...`);
    const zoneCandidates = zones.filter(v => customDomain === v.name || customDomain.endsWith('.' + v.name));
    if (zoneCandidates.length === 0) throw new Error(`Unable to locate the parent zone, do you have permissions to edit zones?`);
    if (zoneCandidates.length > 1) throw new Error(`Unable to locate the parent zone, multiple candidates: ${zoneCandidates.map(v => v.name).join(', ')}`);
    const [ zone ] = zoneCandidates;
    checkEqual('zone.paused', zone.paused, false);
    checkEqual('zone.status', zone.status, 'active');
    checkEqual('zone.type', zone.type, 'full');

    // idempotent
    await putWorkersDomain({ accountId, apiToken, hostname: customDomain, zoneId: zone.id, service: scriptName, environment: 'production' });
}

function computeMigrations(deleteClassOpt: string[] | undefined): Migrations | undefined {
    const deleted_classes = deleteClassOpt ?? [];
    if (deleted_classes.length > 0) {
        return { tag: `delete-${deleted_classes.join('-')}`, deleted_classes };
    }
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
    scriptContents = scriptContents.replace(/const\s+\{\s*connect\s*\}\s*=\s*cloudflareSockets\(\);/, `import { connect } from "cloudflare:sockets";`);
    scriptContents = scriptContents.replace(/const\s+\{\s*EmailMessage\s*\}\s*=\s*cloudflareEmail\(\);/, `import { EmailMessage } from "cloudflare:email";`);
    scriptContents = scriptContents.replace(/const\s+\{\s*PipelineTransform\s*\}\s*=\s*cloudflarePipelineTransform\(\);/, `import { PipelineTransform } from "cloudflare:pipeline-transform";`);
    return await replaceImports(scriptContents, rootSpecifier, ({ relativePath, value, valueBytes, variableName }) => {
        parts.push({ name: relativePath, fileName: relativePath, value, valueBytes });
        return `import ${variableName} from ${'"'}${relativePath}";`;
    })
}

//

class DurableObjectNamespaces {
    private readonly accountId: string;
    private readonly apiToken: string;

    private readonly pendingUpdates: { id: string, name?: string, script?: string, class?: string }[] = [];

    readonly containerClassNames: string[] = [];
    readonly namespaceIdsToContainerSpecs = new Map<string, string>();
    readonly namespaceIdsToNamespaceNames = new Map<string, string>();

    constructor(accountId: string, apiToken: string) {
        this.accountId = accountId;
        this.apiToken = apiToken;
    }

    async getOrCreateNamespaceId(namespaceSpec: string, scriptName: string, containerSpec: string | undefined): Promise<string> {
        const tokens = namespaceSpec.split(':');
        if (tokens.length !== 2 && tokens.length !== 3) throw new Error(`Bad durable object namespace spec: ${namespaceSpec}`);
        const name = tokens[0];
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error(`Bad durable object namespace name: ${name}`);
        const className = tokens[1];
        let useSqlite: boolean | undefined;
        const opts = tokens[2];
        if (typeof opts === 'string') {
            for (const pair of opts.split(',')) {
                const [ _, name, value ] = checkMatchesReturnMatcher('pair', pair, /^([a-z]+)=([a-z]+)$/);
                if (name === 'backend') {
                    if (value === 'sql') {
                        useSqlite = true;
                    } else if (value !== 'kv') {
                        throw new Error(`Bad 'backend' option value: ${value} (must be 'sql' or 'kv')`);
                    }
                }
            }
        }
        const { accountId, apiToken,containerClassNames, namespaceIdsToContainerSpecs, namespaceIdsToNamespaceNames } = this;
        const namespaces = await listDurableObjectsNamespaces({ accountId, apiToken, perPage: 1000 });
        let namespace = namespaces.find(v => v.name === name);
        if (!namespace)  {
            console.log(`Creating new durable object namespace: ${name}`);
            namespace = await createDurableObjectsNamespace({ accountId, apiToken, name, useSqlite });
        }
        if (namespace.class !== className || namespace.script !== scriptName) {
            this.pendingUpdates.push({ id: namespace.id, name, script: scriptName, class: className });
        }
        if (typeof containerSpec === 'string') {
            if (!containerClassNames.includes(className)) containerClassNames.push(className);
            namespaceIdsToContainerSpecs.set(namespace.id, containerSpec);
        }
        namespaceIdsToNamespaceNames.set(namespace.id, name);
        return namespace.id;
    }

    hasPendingUpdates() {
        return this.pendingUpdates.length > 0;
    }

    async flushPendingUpdates() {
        const { accountId, apiToken } = this;
        for (const { id, name, script, class: className } of this.pendingUpdates) {
            console.log(`Updating durable object namespace ${name}: script=${script}, class=${className}`);
            await updateDurableObjectsNamespace({ accountId, apiToken, id, name, script, className });
        }
        this.pendingUpdates.splice(0);
    }
}

//

async function computeBindings(inputBindings: Record<string, Binding>, scriptName: string, doNamespaces: DurableObjectNamespaces, pushId: string | undefined): Promise<{ bindings: ApiBinding[], parts: Part[] }> {
    const resolvedBindings = await resolveBindings(inputBindings, { pushId });
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
        return { type: 'durable_object_namespace', name, namespace_id: await doNamespaces.getOrCreateNamespaceId(binding.doNamespace, scriptName, binding.container) };
    } else if (isWasmModuleBinding(binding)) {
        return { type: 'wasm_module', name, part: await computeWasmModulePart(binding.wasmModule, parts, name) };
    } else if (isServiceBinding(binding)) {
        const [ _, service, environment ] = checkMatchesReturnMatcher('serviceEnvironment', binding.serviceEnvironment, /^(.*?):(.*?)$/);
        return { type: 'service', name, service, environment };
    } else if (isR2BucketBinding(binding)) {
        return { type: 'r2_bucket', name, bucket_name: binding.bucketName };
    } else if (isAnalyticsEngineBinding(binding)) {
        return { type: 'analytics_engine', name, dataset: binding.dataset };
    } else if (isD1DatabaseBinding(binding)) {
        return { type: 'd1', name, id: binding.d1DatabaseUuid };
    } else if (isQueueBinding(binding)) {
        return { type: 'queue', name, queue_name: binding.queueName };
    } else if (isSecretKeyBinding(binding)) {
        const { format, algorithm, usages, base64 } = parseCryptoKeyDef(binding.secretKey);
        return { type: 'secret_key', name, format, algorithm, usages, key_base64: base64 };
    } else if (isBrowserBinding(binding)) {
        return { type: 'browser', name };
    } else if (isAiBinding(binding)) {
        return { type: 'ai', name };
    } else if (isHyperdriveBinding(binding)) {
        return { type: 'hyperdrive', name, id: binding.hyperdrive };
    } else if (isVersionMetadataBinding(binding)) {
        return { type: 'version_metadata', name };
    } else if (isSendEmailBinding(binding)) {
        const [ addressesStr ] = checkMatchesReturnMatcher('sendEmailDestinationAddresses', binding.sendEmailDestinationAddresses.trim(), /^|unrestricted|[^\s,]+@[^\s,]+\.[^\s,]+(,[^\s,]+@[^\s,]+\.[^\s,]+)*$/);
        const [ destination_address, allowed_destination_addresses ] = (() => {
            if (addressesStr === '' || addressesStr === 'unrestricted') return [ undefined, undefined ];
            const addresses = addressesStr.split(',');
            if (addresses.length === 1) return [ addresses[0], undefined ];
            return [ undefined, addresses ];
        })();
        return { type: 'send_email', name, destination_address, allowed_destination_addresses };
    } else if (isRatelimitBinding(binding)) {
        const [ _, namespace_id, limitStr, periodStr ] = checkMatchesReturnMatcher('ratelimit', binding.ratelimit.trim(), /^(\d+):(\d+):(\d+)$/);
        const limit = parseInt(limitStr);
        const period = parseInt(periodStr);
        return { type: 'ratelimit', name, namespace_id, simple: { limit, period } };
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
