import { Architecture, CreateFunctionRequest, FunctionConfiguration, Policy, PublishLayerVersionRequest, UpdateFunctionCodeRequest, UpdateFunctionConfigurationRequest, addPermission, createFunction, createFunctionUrlConfig, getFunctionConfiguration, getFunctionUrlConfig, getLayerVersion, getPolicy, listLayerVersions, publishLayerVersion, updateFunctionCode, updateFunctionConfiguration } from '../common/aws/aws_lambda.ts';
import { createDenoLayerZip, createRuntimeZip } from '../common/aws/lambda_runtime_zip.ts';
import { Bytes } from '../common/bytes.ts';
import { check, checkMatches, checkMatchesReturnMatcher } from '../common/check.ts';
import { CloudflareApi } from '../common/cloudflare_api.ts';
import { Binding } from '../common/config.ts';
import { isValidScriptName } from '../common/config_validation.ts';
import { AwsCallContext, AwsCredentials } from '../common/r2/r2.ts';
import { bundle, commandOptionsForBundle, parseBundleOpts } from './bundle.ts';
import { ContentBasedFileBasedImports } from './cli_common.ts';
import { commandOptionsForInputBindings, computeContentsForScriptReference, denoflareCliCommand, parseInputBindingsFromOptions } from './cli_common.ts';
import { CLI_VERSION } from './cli_version.ts';
import { commandOptionsForConfigOnly, loadAwsCredentialsForProfile, loadConfig, resolveBindings } from './config_loader.ts';
import { isAbsolute, resolve } from './deps_cli.ts';
import { ModuleWatcher } from './module_watcher.ts';
import { versionCompare } from './versions.ts';

export const PUSH_LAMBDA_COMMAND = denoflareCliCommand('push-lambda', 'Upload a Cloudflare worker script to AWS Lambda + public function URL')
    .arg('scriptSpec', 'string', 'Name of script defined in .denoflare config, file path to bundled js worker, or an https url to a module-based worker .ts, e.g. https://path/to/worker.ts')
    .option('name', 'string', `Name to use for lambda function name [default: Name of script defined in .denoflare config, or https url basename sans extension]`)
    .option('role', 'string', 'IAM role arn for the lambda function (e.g. arn:aws:iam::123412341234:role/my-lambda-role)', { hint: 'role-arn' })
    .option('region', 'string', 'AWS region (e.g. us-east-1)', { hint: 'region-name' })
    .option('architecture', 'enum', 'Lambda architecture', { value: 'x86' }, { value: 'arm' })
    .option('memory', 'integer', 'Memory for the lambda function, in MB (default: 128)', { hint: 'mb', min: 128, max: 10240 })
    .option('storage', 'integer', 'Size of the /tmp directory for the lambda function, in MB (default: 512)', { hint: 'mb', min: 512, max: 10240 })
    .option('timeout', 'integer', 'How long the lambda function is allowed to run, in seconds (default: 3)', { hint: 'seconds', min: 1, max: 900 })
    .option('noLayer', 'boolean', 'Skip creating a layer, deploy the lambda as one large zip (slower for multiple pushes)')
    .option('denoVersion', 'string', `Explicit deno version to use on lambda (default: Deno.version.deno)`, { hint: 'x.x.x' })
    .option('profile', 'string', 'AWS credentials for deploying the worker, from $HOME/.aws/credentials')
    .option('accessKey', 'string', 'AWS credentials for deploying the worker (e.g. AKIA4ABC89ABC89ABC89)')
    .option('secretKey', 'string', 'AWS credentials for deploying the worker (e.g. aB98mjz0aB98mjz0aB98mjz0aB98mjz0aB98mjz0)')
    .option('watch', 'boolean', 'If set, watch the local file system and automatically re-upload on script changes')
    .option('watchInclude', 'strings', 'If watching, watch this additional path as well (e.g. for dynamically-imported static resources)', { hint: 'path' })
    .include(commandOptionsForInputBindings)
    .include(commandOptionsForConfigOnly)
    .include(commandOptionsForBundle)
    .docsLink('/cli/push-lambda')
    ;

export async function pushLambda(args: (string | number)[], options: Record<string, unknown>) {
    if (PUSH_LAMBDA_COMMAND.dumpHelp(args, options)) return;

    const opt = PUSH_LAMBDA_COMMAND.parse(args, options);
    const { scriptSpec, verbose, name: nameOpt, role: roleOpt, region: regionOpt, architecture: architectureOpt, memory: memoryOpt, storage: storageOpt, timeout: timeoutOpt, noLayer: noLayerOpt, denoVersion: denoVersionOpt, profile: profileOpt, accessKey: accessKeyOpt, secretKey: secretKeyOpt, watch, watchInclude } = opt;

    if (verbose) {
        // in cli
        ModuleWatcher.VERBOSE = verbose;
        CloudflareApi.DEBUG = true;
    }

    const config = await loadConfig(options);
    const { scriptName, rootSpecifier, script } = await computeContentsForScriptReference(scriptSpec, config, nameOpt);
    if (!isValidScriptName(scriptName)) throw new Error(`Bad scriptName: ${scriptName}`);
    const inputBindings = { ...(script?.bindings || {}), ...parseInputBindingsFromOptions(options) };
    const bundleOpts = parseBundleOpts(options);
    const { region, role, architectureStr, memory, storage, timeout, noLayer, denoVersion, profile, accessKey, secretKey } = (() => {
        const { lambda } = script ?? {};
        const configOpts: Record<string, string> = {};
        if (lambda) {
            for (const token of lambda.trim().split(',')) {
                const m = /^([a-z-]+)=(.+?)$/.exec(token.trim());
                if (!m) throw new Error(`Invalid lambda config: ${lambda}`);
                const [ _, name, value ] = m;
                configOpts[name] = value;
            }
        }
        const region = regionOpt ?? configOpts.region;
        const role = roleOpt ?? configOpts.role;
        const architectureStr = architectureOpt ?? configOpts.architecture;
        const memory = memoryOpt ?? (configOpts.memory ? parseInt(configOpts.memory) : 128);
        const storage = storageOpt ?? (configOpts.storage ? parseInt(configOpts.storage) : 512);
        const timeout = timeoutOpt ?? (configOpts.timeout ? parseInt(configOpts.timeout) : 3);
        const noLayer = typeof noLayerOpt === 'boolean' ? noLayerOpt : configOpts['no-layer'] === 'true';
        const denoVersion = denoVersionOpt ?? configOpts['deno-version'] ?? Deno.version.deno;
        const profile = profileOpt ?? configOpts.profile;
        const accessKey = accessKeyOpt ?? configOpts['access-key'];
        const secretKey = secretKeyOpt ?? configOpts['secret-key'];
        return { region, role, architectureStr, memory, storage, timeout, noLayer, denoVersion, profile, accessKey, secretKey };
    })();
    checkMatches('region', region, /^[a-z]+(-[a-z0-9]+)+$/);
    checkMatches('role', role, /^arn:aws:iam::\d{12}:role\/.+?$/);
    if (architectureStr !== 'arm' && architectureStr !== 'x86') throw new Error(`Unexpected architecture: ${architectureStr}`);
    const architecture: Architecture = architectureStr === 'arm' ? 'arm64' : 'x86_64';
    const credentials: AwsCredentials = await (async () => {
        if (typeof accessKey === 'string' && typeof secretKey === 'string') {
            check('accessKey', accessKey, v => v.trim() === v && v.length > 0);
            check('secretKey', secretKey, v => v.trim() === v && v.length > 0);
            return { accessKey, secretKey };
        } else if (typeof profile === 'string') {
            check('profile', profile, v => v.trim() === v && v.length > 0);
            const { accessKeyId: accessKey, secretAccessKey: secretKey } = await loadAwsCredentialsForProfile(profile);
            return { accessKey, secretKey };
        } else {
            throw new Error(`Provide AWS credentials for deploying the worker via either --profile, or --access-key and --secret-key`);
        }
    })();

    const pushStart = new Date().toISOString().substring(0, 19) + 'Z';
    let pushNumber = 1;
    let layerVersionArn: string | undefined;
    let existingFunctionConfiguration: FunctionConfiguration | undefined;
    let functionUrl: string | undefined;

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
        const pushId = watch ? `${pushStart}.${pushNumber}` : undefined;
        const pushIdSuffix = pushId ? ` ${pushId}` : '';
        const environmentVariables = await computeEnvironmentVariables(inputBindings, pushId);
        console.log(`computed environment variables in ${Date.now() - start}ms`);

        if (isModule) {
            scriptContentsStr = rewriteScriptContents(scriptContentsStr);
        }

        console.log(`pushing ${isModule ? 'module' : 'script'}-based lambda worker ${scriptName}${pushIdSuffix}...`);

        start = Date.now();

        const runtime = 'provided.al2023'; // needed for deno > 1.35.3, includes newer glibc - also smaller and better suited to this custom runtime
        const functionName = scriptName;
        const handler = 'what.ever'; // unused in the current runtime
        const context: AwsCallContext = {
            userAgent: `denoflare/${CLI_VERSION} (deno/${Deno.version.deno})`,
            credentials,
        }
        const layerName = `deno-${denoVersion.replaceAll('.', '_')}-${architecture}`;
     
        const computeDenoZipStream = async () => {
            const denoZipUrl = architecture as string === 'arm64' ? (versionCompare(denoVersion, '1.40.5') <= 0 ? `https://github.com/LukeChannings/deno-arm64/releases/download/v${denoVersion}/deno-linux-arm64.zip` : `https://github.com/denoland/deno/releases/download/v${denoVersion}/deno-aarch64-unknown-linux-gnu.zip`)
                : `https://github.com/denoland/deno/releases/download/v${denoVersion}/deno-x86_64-unknown-linux-gnu.zip`
            const res = await fetch(denoZipUrl);
            if (!res.ok || !res.body) throw new Error(`${res.status} for ${denoZipUrl}`);
            return res.body;
        }
    
        // first, ensure deno layer exists if applicable
        if (layerVersionArn === undefined && !noLayer) {
            console.log(`packaging ${layerName} layer zip...`);
            const denoZipStream = await computeDenoZipStream();
            const { zipBlob, sha1Hex: _ }  = await createDenoLayerZip({ denoZipStream });
            const zipFileBytes = new Bytes(new Uint8Array(await zipBlob.arrayBuffer()));
            const zipFileSha256Base64 = (await zipFileBytes.sha256()).base64();
            console.log(`  compressed size: ${Bytes.formatSize(zipFileBytes.length)}`);
    
            console.log(`checking to see if layer already exists...`);
            const listResponse = await listLayerVersions({ layerName, context, region, request: { CompatibleArchitecture: architecture, CompatibleRuntime: runtime, MaxItems: 50 } });
            for (const layerVersion of listResponse.LayerVersions) {
                const { Version: versionNumber } = layerVersion;
                const response = await getLayerVersion({ layerName, versionNumber, context, region });
                if (response && response.Content.CodeSha256 === zipFileSha256Base64) {
                    layerVersionArn = response.LayerVersionArn;
                    break;
                }
            }
            if (layerVersionArn === undefined) {
                const zipFileBase64 = zipFileBytes.base64();
                const request: PublishLayerVersionRequest = {
                    Content: {
                        ZipFile: zipFileBase64,
                    },
                    CompatibleArchitectures: [ architecture ],
                    CompatibleRuntimes: [ runtime ],
                }
                console.log(`publishing layer...`);
                const result = await publishLayerVersion({ layerName, request, region, context });
                layerVersionArn = result.LayerVersionArn;
            } else {
                console.log(`  layer exists`);
            }
        }

        // package and push lambda zip (bootstrap, runtime, worker, and deno if applicable)
        console.log(`packaging lambda zip...`);
        const runtimeTs = await (await fetch(new URL('../common/aws/lambda_runtime.ts', import.meta.url))).text();
        const runtimeTypesTs = await (await fetch(new URL('../common/aws/lambda_runtime.d.ts', import.meta.url))).text();
        const denoZipStream = layerVersionArn ? undefined : await computeDenoZipStream();
        const imports = new ContentBasedFileBasedImports();
        const workerTs = await imports.rewriteScriptContents(scriptContentsStr, rootSpecifier);
        const additionalBlobs = Object.fromEntries([...imports.allFiles.entries()].map(v => [ v[0], v[1].bytes ]));
        const { zipBlob, sha1Hex: _ } = await createRuntimeZip({ runtimeTs, runtimeTypesTs, workerTs, denoZipStream, additionalBlobs });
        const zipFileBytes = new Bytes(new Uint8Array(await zipBlob.arrayBuffer()));
        const zipFileBase64 = zipFileBytes.base64();
        console.log(`  compressed size: ${Bytes.formatSize(zipFileBytes.length)}`);

        if (!existingFunctionConfiguration) {
            console.log(`checking if function exists...`);
            existingFunctionConfiguration = await getFunctionConfiguration({ functionName, region, context });
        }
        if (existingFunctionConfiguration) {
            if ((existingFunctionConfiguration.Architectures ?? [])[0] !== architecture) throw new Error(`Cannot update function architecture. Create a new one, or delete and recreate this one.`);

            const changed = (() => {
                if (layerVersionArn) {
                    const layerFound = (existingFunctionConfiguration.Layers ?? []).some(v => v.Arn === layerVersionArn);
                    if (!layerFound) return 'layer';
                } else {
                    if ((existingFunctionConfiguration.Layers ?? []).length > 0) return 'layer';
                }
                const existingVars = existingFunctionConfiguration.Environment?.Variables ?? {};
                if (!computeRecordsEqual(existingVars, environmentVariables)) return 'envVars'
                if (existingFunctionConfiguration.Handler !== handler) return 'handler';
                if (existingFunctionConfiguration.MemorySize !== memory) return 'memory';
                if (existingFunctionConfiguration.EphemeralStorage?.Size !== storage) return 'storage';
                if (existingFunctionConfiguration.Role !== role) return 'role';
                if (existingFunctionConfiguration.Runtime !== runtime) return 'runtime';
                if (existingFunctionConfiguration.Timeout !== timeout) return 'timeout';
                return undefined;
            })();
            if (changed) {
                console.log(`updating function configuration (${changed})...`);
                const request: UpdateFunctionConfigurationRequest = {
                    Handler: handler,
                    MemorySize: memory,
                    EphemeralStorage: {
                        Size: storage,
                    },
                    Role: role,
                    Runtime: runtime,
                    Timeout: timeout,
                    Layers: layerVersionArn ? [ layerVersionArn ] : undefined,
                    Environment: {
                        Variables: environmentVariables,
                    },
                }
                existingFunctionConfiguration = await updateFunctionConfiguration({ functionName, request, region, context });
            }
            
            const zipFileSha256Base64 = (await zipFileBytes.sha256()).base64();
            if (existingFunctionConfiguration.CodeSha256 === zipFileSha256Base64) {
                console.log(`  function code already up to date`);
            } else {
                console.log(`updating function code...`);
                const request: UpdateFunctionCodeRequest = {
                    Architectures: [ architecture ],
                    ZipFile: zipFileBase64,
                    Publish: true,
                }
                existingFunctionConfiguration = await updateFunctionCode({ functionName, request, region, context });
            }
        } else {
            console.log(`creating function...`);
            const request: CreateFunctionRequest = {
                Architectures: [ architecture ],
                Code: { ZipFile: zipFileBase64 },
                FunctionName: functionName,
                Handler: handler,
                MemorySize: memory,
                EphemeralStorage: {
                    Size: storage,
                },
                PackageType: 'Zip',
                Publish: true,
                Role: role,
                Runtime: runtime,
                Timeout: timeout,
                Layers: layerVersionArn ? [ layerVersionArn ] : undefined,
                Environment: {
                    Variables: environmentVariables,
                }
            }
            existingFunctionConfiguration = await createFunction({ request, region, context });
        }
        
        // finally, ensure function url exists for the lambda
        if (!functionUrl) {
            console.log(`checking if function url exists...`);
            const urlConfig = await getFunctionUrlConfig({ functionName, region, context });
            if (urlConfig) {
                functionUrl = urlConfig.FunctionUrl;
            } else {
                console.log(`creating function url...`);
                const result = await createFunctionUrlConfig({ functionName, context, region, request: { AuthType: 'NONE' } });
                functionUrl = result.FunctionUrl;
            }
            
            const awsAccountId = checkMatchesReturnMatcher('role', role, /^arn:aws:iam::(\d{12}):role\//)[1];
            const functionArn = `arn:aws:lambda:${region}:${awsAccountId}:function:${functionName}`;

            // https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html#urls-auth-none
            console.log(`checking if resource-based policies exist...`);
            const policyResponse = await getPolicy({ functionName, region, context });
            let found1 = false;
            let found2 = false;
            if (policyResponse) {
                const policy = JSON.parse(policyResponse.Policy) as Policy;
                for (const statement of policy.Statement) {
                    const { Resource, Effect, Action, Principal, Condition } = statement;
                    if (Resource === functionArn && Effect === 'Allow' && Action === 'lambda:InvokeFunctionUrl' && Principal === '*' && (Condition === undefined || (Condition.StringEquals !== undefined && Condition.StringEquals['lambda:FunctionUrlAuthType'] === 'NONE'))) {
                        found1 = true;
                    }
                    if (Resource === functionArn && Effect === 'Allow' && Action === 'lambda:InvokeFunction' && Principal === '*' && (Condition === undefined || (Condition.Bool !== undefined && Condition.Bool['lambda:InvokedViaFunctionUrl'] === 'true'))) {
                        found2 = true;
                    }
                }
            }
            if (!found1) {
                console.log(`adding resource-based policy FunctionURLAllowPublicAccess...`);
                await addPermission({ functionName, context, region, request: { Action: 'lambda:InvokeFunctionUrl', Principal: '*', StatementId: 'FunctionURLAllowPublicAccess', FunctionUrlAuthType: 'NONE' } });
            }
            if (!found2) {
                console.log(`adding resource-based policy FunctionURLInvokeAllowPublicAccess...`);
                await addPermission({ functionName, context, region, request: { Action: 'lambda:InvokeFunction', Principal: '*', StatementId: 'FunctionURLInvokeAllowPublicAccess', InvokedViaFunctionUrl: true } });
            }
        }

        console.log(`deployed worker to ${functionUrl} in ${Date.now() - start}ms`);
        
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

function rewriteScriptContents(scriptContents: string): string {
    // nothing yet
    return scriptContents;
}

async function computeEnvironmentVariables(inputBindings: Record<string, Binding>, pushId: string | undefined): Promise<Record<string, string>> {
    const resolvedBindings = await resolveBindings(inputBindings, { pushId });
    const rt: Record<string, string> = {};
    for (const [ name, binding ] of Object.entries(resolvedBindings)) {
        rt[`BINDING_${name}`] = JSON.stringify(binding);
    }
    return rt;
}

function computeRecordsEqual(lhs: Record<string, string>, rhs: Record<string, string>): boolean {
    const str = (r: Record<string, string>) => Object.keys(r).sort().map(v => `${v}=${r[v]}`).join(',');
    return str(lhs) === str(rhs);
}
