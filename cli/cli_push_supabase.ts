import { Bytes } from '../common/bytes.ts';
import { Binding, isSecretBinding, isTextBinding } from '../common/config.ts';
import { isValidScriptName } from '../common/config_validation.ts';
import { bundle, commandOptionsForBundle, parseBundleOpts } from './bundle.ts';
import { commandOptionsForInputBindings, computeContentsForScriptReference, denoflareCliCommand, parseInputBindingsFromOptions, replaceImports } from './cli_common.ts';
import { commandOptionsForConfigOnly, loadConfig, resolveBindings } from './config_loader.ts';
import { isAbsolute, resolve } from './deps_cli.ts';
import { ModuleWatcher } from './module_watcher.ts';
import { listFunctions, bulkCreateSecrets, listSecrets, createFunction, updateFunction, bulkDeleteSecrets } from '../common/supabase/supabase_api.ts';
import { brotliCompressEszip, buildEszip } from '../common/supabase/eszip.ts';

export const PUSH_SUPABASE_COMMAND = denoflareCliCommand('push-supabase', 'Upload a Cloudflare worker script to Supabase Edge Functions')
    .arg('scriptSpec', 'string', 'Name of script defined in .denoflare config, file path to bundled js worker, or an https url to a module-based worker .ts, e.g. https://path/to/worker.ts')
    .option('name', 'string', `Slug name of the Supabase Edge Function [default: Name of script defined in .denoflare config, or https url basename sans extension]`)
    .option('accessToken', 'string', 'Supabase Personal token, from the Supabase dashboard > account > access tokens (or set SUPABASE_ACCESS_TOKEN env var)')
    .option('projectRef', 'string', 'Supabase project reference (e.g. ) (or set SUPABASE_PROJECT_ID env var)', { hint: '20-char unique id'})
    .option('watch', 'boolean', 'If set, watch the local file system and automatically re-upload on script changes')
    .option('watchInclude', 'strings', 'If watching, watch this additional path as well (e.g. for dynamically-imported static resources)', { hint: 'path' })
    .option('listFunctions', 'boolean', '')
    .include(commandOptionsForInputBindings)
    .include(commandOptionsForConfigOnly)
    .include(commandOptionsForBundle)
    .docsLink('/cli/push-supabase')
    ;

export async function pushSupabase(args: (string | number)[], options: Record<string, unknown>) {
    if (PUSH_SUPABASE_COMMAND.dumpHelp(args, options)) return;

    const opt = PUSH_SUPABASE_COMMAND.parse(args, options);
    const { scriptSpec, verbose, name: nameOpt, accessToken: accessTokenOpt, projectRef: projectRefOpt, listFunctions: listFunctionsOpt, watch, watchInclude } = opt;

    if (verbose) {
        // in cli
        ModuleWatcher.VERBOSE = verbose;
    }

    const config = await loadConfig(options);
    const { scriptName, rootSpecifier, script } = await computeContentsForScriptReference(scriptSpec, config, nameOpt);
    if (!isValidScriptName(scriptName)) throw new Error(`Bad scriptName: ${scriptName}`);
    const inputBindings = { ...(script?.bindings || {}), ...parseInputBindingsFromOptions(options) };
    const bundleOpts = parseBundleOpts(options);
    const { accessToken, projectRef } = (() => {
        const { supabase } = script ?? {};
        const configOpts: Record<string, string> = {};
        if (supabase) {
            for (const token of supabase.trim().split(',')) {
                const m = /^([a-z-]+)=(.+?)$/.exec(token.trim());
                if (!m) throw new Error(`Invalid supabase config: ${supabase}`);
                const [ _, name, value ] = m;
                configOpts[name] = value;
            }
        }
        const accessToken = accessTokenOpt ?? configOpts['access-token'] ?? Deno.env.get('SUPABASE_ACCESS_TOKEN');
        const projectRef = projectRefOpt ?? configOpts['project-ref'] ?? Deno.env.get('SUPABASE_PROJECT_ID');
        return { accessToken, projectRef };
    })();
    if (accessToken === undefined) throw new Error(`Provide access token for deploying the worker via either --access-token, in config, or SUPABASE_ACCESS_TOKEN env var`);

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
        const pushId = watch ? `${pushStart}.${pushNumber}` : undefined;
        const pushIdSuffix = pushId ? ` ${pushId}` : '';
        const environmentVariables = await computeEnvironmentVariables(inputBindings, pushId);

        const allFiles = new Map<string, FileEntry>();

        if (isModule) {
            scriptContentsStr = await rewriteScriptContents(scriptContentsStr, rootSpecifier, allFiles);
        }

        if (!isModule) throw new Error(`Only module-based workers are supported`);

        console.log(`pushing ${isModule ? 'module' : 'script'}-based supabase worker ${scriptName}${pushIdSuffix}...`);

        start = Date.now();

        const token = accessToken;

        const { result: functions } = await listFunctions({ token, projectRef });
        if (listFunctionsOpt) {
            for (const functionInfo of functions) {
                console.log(JSON.stringify(functionInfo));
            }
            return;
        }

        const computeScriptScopedSecretName = (envVarName: string) => `${scriptName}-${envVarName}`;
        const { result: secrets } = await listSecrets({ projectRef, token });
        const secretNamesToDelete = new Set(secrets.filter(v => v.name.startsWith(computeScriptScopedSecretName(''))).map(v => v.name));
        let updateSecrets = false;
        for (const [ name, value ] of Object.entries(environmentVariables)) {
            const secretName = computeScriptScopedSecretName(name);
            secretNamesToDelete.delete(secretName);
            const existingHex = secrets.find(v => v.name === secretName)?.value;
            if (!existingHex || (await Bytes.ofUtf8(value).sha256()).hex() !== existingHex) {
                updateSecrets = true;
                break;
            }
        }
        if (updateSecrets) {
            console.log(`updating project secrets...`);
            const secrets = Object.entries(environmentVariables).map(v => ({ name: computeScriptScopedSecretName(v[0]), value: v[1] }));
            await bulkCreateSecrets({ token, projectRef, secrets });
        }
        if (secretNamesToDelete.size > 0) {
            console.log(`removing ${secretNamesToDelete.size} obsolete project secret${secretNamesToDelete.size > 1 ? 's' : ''}...`);
            await bulkDeleteSecrets({ projectRef, names: [...secretNamesToDelete], token });
        }
        
        console.log(`creating deployment package...`);
        const appTs = (await (await fetch(new URL('../common/supabase/supabase_app.ts', import.meta.url))).text()).replace('${scriptName}', scriptName);
        const importTemplateJs = await (await fetch(new URL('../common/supabase/supabase_import_template.js', import.meta.url))).text();

        const workerTs = scriptContentsStr;

        const additional: Record<string, string> = {};
        for (const [ name, { bytes } ] of allFiles) {
            const spec = `file:///src/${name}.js`;
            const source = importTemplateJs.replace('EXPORT_B64', new Bytes(bytes).base64());
            additional[spec] = source;
        }

        const entry = 'file:///src/index.ts';
        const eszipBytes = await buildEszip([ entry, ...Object.keys(additional) ], specifier => {
            if (specifier === entry) return appTs;
            if (specifier === `file:///src/worker.ts`) return workerTs;
            return additional[specifier];
        });
        await Deno.writeFile('/Users/js/tmp/push-supabase.eszip2', eszipBytes);
        const brotliCompressedEszip = brotliCompressEszip(eszipBytes);

        const slug = scriptName;
        if (functions.some(v => v.slug === slug)) {
            console.log(`updating edge function...`);
            await updateFunction({ projectRef, slug, name: slug, import_map: true, verify_jwt: false, entrypoint_path: entry, brotliCompressedEszip, token });
        } else {
            console.log(`creating edge function...`);
            await createFunction({ projectRef, slug, name: slug, import_map: true, verify_jwt: false, entrypoint_path: entry, brotliCompressedEszip, token });
        }

        console.log(`deployed worker to ${scriptName} in ${Date.now() - start}ms`);
        
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

type FileEntry = { size: number, bytes: Uint8Array, gitSha1: string };

async function rewriteScriptContents(scriptContents: string, rootSpecifier: string, allFiles: Map<string, FileEntry>): Promise<string> {
    return await replaceImports(scriptContents, rootSpecifier, async ({ valueBytes: bytes, line, importMetaVariableName, unquotedModuleSpecifier }) => {
        const gitSha1 = await new Bytes(bytes).gitSha1Hex();
        const size = bytes.length;
        const filename = `_import_${gitSha1}.dat`;
        allFiles.set(filename, { bytes, gitSha1, size });
        const rt = line.replace(importMetaVariableName, 'import.meta').replace(unquotedModuleSpecifier, `./${filename}`);
        const endparen = rt.lastIndexOf(')');
        return rt.substring(0, endparen) + `, async (url) => new Response((await import('file:///src/${filename}.js')).BYTES));`;
    });
}

async function computeEnvironmentVariables(inputBindings: Record<string, Binding>, pushId: string | undefined): Promise<Record<string, string>> {
    const resolvedBindings = await resolveBindings(inputBindings, { pushId });
    const rt: Record<string, string> = {};
    for (const [ name, binding ] of Object.entries(resolvedBindings)) {
        if (isTextBinding(binding)) {
            rt[name] = binding.value;
        } else if (isSecretBinding(binding)) {
            rt[name] = binding.secret;
        } else {
            throw new Error(`Env binding not supported on Supabase: ${JSON.stringify(binding)}`);
        }
    }
    return rt;
}
