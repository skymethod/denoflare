import { commandOptionsForConfig, loadConfig, resolveProfile } from './config_loader.ts';
import { CloudflareApi, createPubsubBroker, createPubsubNamespace, createQueue, createR2Bucket, deletePubsubBroker, deletePubsubNamespace, deletePubsubRevocations, deleteQueue, deleteQueueConsumer, deleteR2Bucket, deleteTraceWorker, deleteWorkersDomain, generatePubsubCredentials, getKeyMetadata, getKeyValue, getPubsubBroker, getQueue, getR2BucketUsageSummary, getUser, getWorkerAccountSettings, getWorkerServiceMetadata, getWorkerServiceSubdomainEnabled, getWorkersSubdomain, listAccounts, listDurableObjects, listDurableObjectsNamespaces, listFlags, listMemberships, listPubsubBrokerPublicKeys, listPubsubBrokers, listPubsubNamespaces, listPubsubRevocations, listQueues, listR2Buckets, listScripts, listTraceWorkers, listUserBillingHistory, listWorkerDeployments, listWorkersDomains, listZones, putKeyValue, putQueueConsumer, putWorkerAccountSettings, putWorkersDomain, queryAnalyticsEngine, revokePubsubCredentials, setTraceWorker, setWorkerServiceSubdomainEnabled, updatePubsubBroker, verifyToken } from '../common/cloudflare_api.ts';
import { check } from '../common/check.ts';
import { Bytes } from '../common/bytes.ts';
import { denoflareCliCommand, parseOptionalIntegerOption, parseOptionalStringOption } from './cli_common.ts';
import { CliCommand, SubcommandHandler } from './cli_command.ts';

export const CFAPI_COMMAND = cfapiCommand();

export async function cfapi(args: (string | number)[], options: Record<string, unknown>) {
    return await CFAPI_COMMAND.routeSubcommand(args, options);
}

//

type ApiHandler<T> = (accountId: string, apiToken: string, opts: T, options: Record<string, unknown>) => Promise<void>;

function cfapiCommand() {
    const apiCommand = (name: string, description: string) => denoflareCliCommand(['cfapi', name], description);
    const rt = denoflareCliCommand('cfapi', 'Call the Cloudflare REST API')
        .docsLink('/cli/cfapi')
        ;
    function add<T>(c: CliCommand<T>, handler: ApiHandler<T>) {
        rt.subcommand(c.include(commandOptionsForConfig), makeSubcommandHandler(c, handler));
    }

    add(apiCommand('list-scripts', 'List Worker scripts')
        .include(commandOptionsForParsePagingOptions)
    , async (accountId, apiToken) => {
        const value = await listScripts({ accountId, apiToken });
        console.log(value);
    });

    add(apiCommand('get-workers-subdomain', 'Get the name of your account-level workers.dev subdomain'), async (accountId, apiToken) => {
        const subdomain = await getWorkersSubdomain({ accountId, apiToken });
        console.log(subdomain);
    });

    add(apiCommand('get-worker-account-settings', 'Get worker account settings'), async (accountId, apiToken) => {
        const settings = await getWorkerAccountSettings({ accountId, apiToken });
        console.log(settings);
    });

    add(apiCommand('put-worker-account-settings', 'Set worker account settings').option('defaultUsageModel', 'required-enum', 'Usage model', { value: 'bundled' }, { value: 'unbound' }), async (accountId, apiToken, opts) => {
        const defaultUsageModel = opts.defaultUsageModel as 'bundled' | 'unbound';
        const success = await putWorkerAccountSettings({ accountId, apiToken, defaultUsageModel });
        console.log(success);
    });

    add(apiCommand('list-flags', 'List account-level flags'), async (accountId, apiToken) => {
        const value = await listFlags({ accountId, apiToken });
        console.log(value);
    });

    add(apiCommand('list-zones', 'List zones')
        .option('match', 'enum', 'Match type', { value: 'any' }, { value: 'all' })
        .option('name', 'string', 'Name filter')
        .option('order', 'enum', 'Order by', { value: 'name' }, { value: 'status' }, { value: 'account.id' }, { value: 'account.name' })
        .option('status', 'enum', 'Status filter', { value: 'active' }, { value: 'pending' }, { value: 'initializing' }, { value: 'moved' }, { value: 'deleted' }, { value: 'deactivated' }, { value: 'read only' })
        .include(commandOptionsForParsePagingOptions)
    , async (accountId, apiToken, opts, options) => {
        const match = opts.match as 'any' | 'all';
        const order = opts.order as 'name' | 'status' | 'account.id' | 'account.name';
        const status = opts.status as 'active' | 'pending' | 'initializing' | 'moved' | 'deleted' | 'deactivated' | 'read only';
        const { name } = opts;
        const { page, perPage, direction } = parsePagingOptions(options);
        const value = await listZones({ accountId, apiToken, match, name, order, page, perPage, status, direction });
        console.log(value);
    });

    rt.subcommandGroup();

    add(apiCommand('put-key-value', 'Set KV value')
        .arg('namespaceId', 'string', 'KV namespace id')
        .arg('key', 'string', 'Key within the namespace')
        .option('string', 'string', 'String value to put')
        .option('file', 'string', 'Path of file to put')
        .option('expiration', 'integer', 'Expiration')
        .option('expirationTtl', 'integer', 'Expiration TTL')
        .option('metadata', 'string', 'JSON object string')
    , async (accountId, apiToken, opts) => {
        const { namespaceId, key, string, file, expiration, expirationTtl, metadata: metadataJson } = opts;
        const value = await (async () => {
            if (typeof string === 'string') return string;
            if (typeof file === 'string') return await Deno.readTextFile(file);
            throw new Error(`Provide 'value' or 'file' options for the key value.`);
        })();
        check('value', value, typeof value === 'string');
        await putKeyValue({ accountId, namespaceId, key, value, apiToken, expiration, expirationTtl, metadata: metadataJson ? JSON.parse(metadataJson) : undefined });
    });

    add(apiCommand('get-key-value', 'Get KV value')
        .arg('namespaceId', 'string', 'KV namespace id')
        .arg('key', 'string', 'Key within the namespace')
        .option('metadata', 'boolean', 'If set, also get metadata')
    , async (accountId, apiToken, opts) => {
        const { namespaceId, key, metadata } = opts;
        const value = await getKeyValue({ accountId, namespaceId, key, apiToken });
        console.log(value ? new Bytes(value).utf8() : value);
        if (metadata) {
            const metadata = await getKeyMetadata(accountId, namespaceId, key, apiToken);
            console.log(JSON.stringify(metadata, undefined, 2));
        }
    });
    
    rt.subcommandGroup();

    add(apiCommand('get-worker-service-subdomain-enabled', 'Get whether or not the workers.dev route is enabled for a given worker service')
        .arg('scriptName', 'string', 'Worker script name (service name)')
        .option('environment', 'string', 'Service environment name (default: production)')
    , async (accountId, apiToken, { scriptName, environment }) => {
        const enabled = await getWorkerServiceSubdomainEnabled({ accountId, apiToken, scriptName, environment });
        console.log({ enabled });
    });

    add(apiCommand('enable-worker-service-subdomain', 'Enable the workers.dev route for a given worker service')
        .arg('scriptName', 'string', 'Worker script name (service name)')
        .option('environment', 'string', 'Service environment name (default: production)')
    , async (accountId, apiToken, { scriptName, environment }) => {
        await setWorkerServiceSubdomainEnabled({ accountId, apiToken, scriptName, environment, enabled: true });
    });

    add(apiCommand('disable-worker-service-subdomain', 'Disable the workers.dev route for a given worker service')
        .arg('scriptName', 'string', 'Worker script name (service name)')
        .option('environment', 'string', 'Service environment name (default: production)')
    , async (accountId, apiToken, { scriptName, environment }) => {
        await setWorkerServiceSubdomainEnabled({ accountId, apiToken, scriptName, environment, enabled: false });
    });

    rt.subcommandGroup();

    add(apiCommand('list-workers-domains', 'List Workers domains').option('hostname', 'string', 'Hostname filter'), async (accountId, apiToken, opts) => {
        const { hostname } = opts;
        const value = await listWorkersDomains({ accountId, apiToken, hostname });
        console.log(value);
    });

    add(apiCommand('put-workers-domain', 'Create a Workers domain')
        .option('hostname', 'required-string', 'Hostname on which to bind the worker')
        .option('zoneId', 'required-string', 'Zone id of the hostname')
        .option('service', 'required-string', 'Worker script name')
        .option('environment', 'string', `Worker script environment name (default: production)`)
    , async (accountId, apiToken, opts) => {
        const { hostname, zoneId, service, environment } = opts;
        const value = await putWorkersDomain({ accountId, apiToken, hostname, zoneId, service, environment: environment ?? 'production' });
        console.log(value);
    });

    add(apiCommand('delete-workers-domain', 'Delete a Worker domain').arg('workersDomainId', 'string', 'ID of the Workers domain'), async (accountId, apiToken, opts) => {
        const { workersDomainId } = opts;
        await deleteWorkersDomain({ accountId, apiToken, workersDomainId });
    });

    rt.subcommandGroup();

    add(apiCommand('list-buckets', 'List R2 buckets'), async (accountId, apiToken) => {
        const value = await listR2Buckets({ accountId, apiToken });
        console.log(value);
    });

    add(apiCommand('create-bucket', 'Create a new R2 bucket').arg('bucketName', 'string', 'Name of the bucket'), async (accountId, apiToken, opts) => {
        const { bucketName } = opts;
        await createR2Bucket({ accountId, bucketName, apiToken });
    });

    add(apiCommand('delete-bucket', 'Delete a R2 bucket').arg('bucketName', 'string', 'Name of the bucket'), async (accountId, apiToken, opts) => {
        const { bucketName } = opts;
        await deleteR2Bucket({ accountId, bucketName, apiToken });
    });

    add(apiCommand('get-bucket-usage-summary', 'Get R2 Bucket usage summary').arg('bucketName', 'string', 'Name of the bucket'), async (accountId, apiToken, opts) => {
        const { bucketName } = opts;
        const value = await getR2BucketUsageSummary({ accountId, bucketName, apiToken });
        console.log(value);
    });

    rt.subcommandGroup();

    add(apiCommand('verify-token', 'Verify an api token'), async (_, apiToken) => {
        const value = await verifyToken({ apiToken });
        console.log(value);
    });

    add(apiCommand('list-memberships', 'List memberships')
        .option('order', 'enum', 'Order by', { value: 'id' }, { value: 'status' }, { value: 'account.name' })
        .option('status', 'enum', 'Status filter', { value: 'accepted' }, { value: 'pending' }, { value: 'rejected' })
        .include(commandOptionsForParsePagingOptions)
    , async (_accountId, apiToken, opts, options) => {
        const order = opts.order as 'id' | 'status' | 'account.name';
        const status = opts.status as 'accepted' | 'pending' | 'rejected';
        const { page, perPage, direction } = parsePagingOptions(options);
        const value = await listMemberships({ apiToken, order, page, perPage, status, direction });
        console.log(value);
    });

    add(apiCommand('list-accounts', 'List accounts')
        .option('name', 'string', 'Account name')
        .include(commandOptionsForParsePagingOptions)
    , async (_accountId, apiToken, opts, options) => {
        const { name } = opts;
        const { page, perPage, direction } = parsePagingOptions(options);
        const value = await listAccounts({ apiToken, page, perPage, name, direction });
        console.log(value);
    });

    add(apiCommand('get-user', 'Get user info'), async (_accountId, apiToken) => {
        const value = await getUser({ apiToken });
        console.log(value);
    });

    add(apiCommand('list-durable-objects-namespaces', 'List Durable Objects namespaces')
    , async (accountId, apiToken) => {
        const value = await listDurableObjectsNamespaces({ accountId, apiToken });
        console.log(value);
    });

    add(apiCommand('list-durable-objects', 'List Durable Objects for a given namespace')
        .arg('durableObjectsNamespaceId', 'string', 'Durable Objects namespace ID to list')
        .option('limit', 'integer', 'Max number of results to return (must be fairly high)')
        .option('cursor', 'string', 'Continue from a previous call')
    , async (accountId, apiToken, opts) => {
        const { durableObjectsNamespaceId: namespaceId, limit, cursor } = opts;
        const { objects, cursor: resultCursor } = await listDurableObjects({ accountId, namespaceId, apiToken, limit, cursor });
        console.log(objects);
        if (resultCursor) console.log(resultCursor);
    });

    rt.subcommandGroup();

    add(apiCommand('list-pubsub-namespaces', 'List Pub/Sub namespaces'), async (accountId, apiToken) => {
        const value = await listPubsubNamespaces({ accountId, apiToken });
        console.log(value);
    });

    add(apiCommand('create-pubsub-namespace', 'Create a Pub/Sub namespace').arg('name', 'string', 'Name of the namespace'), async (accountId, apiToken, opts) => {
        const { name } = opts;
        const value = await createPubsubNamespace({ accountId, apiToken, name });
        console.log(value);
    });

    add(apiCommand('delete-pubsub-namespace', 'Delete a Pub/Sub namespace').arg('name', 'string', 'Name of the namespace'), async (accountId, apiToken, opts) => {
        const { name: namespaceName } = opts;
        await deletePubsubNamespace({ accountId, apiToken, namespaceName });
    });

    add(apiCommand('list-pubsub-brokers', 'List Pub/Sub brokers').arg('name', 'string', 'Name of the namespace'), async (accountId, apiToken, opts) => {
        const { name: namespaceName } = opts;
        const value = await listPubsubBrokers({ accountId, apiToken, namespaceName });
        console.log(value);
    });

    add(apiCommand('create-pubsub-broker', 'Create a Pub/Sub broker').arg('name', 'string', 'Name of the namespace').arg('brokerName', 'string', 'Name of the broker'), async (accountId, apiToken, opts) => {
        const { name: namespaceName, brokerName } = opts;
        const value = await createPubsubBroker({ accountId, apiToken, namespaceName, brokerName, authType: 'TOKEN' });
        console.log(value);
    });

    add(apiCommand('update-pubsub-broker', 'Update a Pub/Sub broker').arg('name', 'string', 'Name of the namespace').arg('brokerName', 'string', 'Name of the broker').option('expirationSeconds', 'integer', 'Expiration').option('onPublishUrl', 'string', 'Public URL to your worker'), async (accountId, apiToken, opts) => {
        const { name: namespaceName, brokerName, expirationSeconds, onPublishUrl: onPublishUrlStr } = opts;
        const expiration = typeof expirationSeconds === 'number' ? expirationSeconds * 1_000_000_000 : undefined;
        const onPublishUrl = onPublishUrlStr === 'null' ? null : typeof onPublishUrlStr === 'string' ? onPublishUrlStr : undefined;
        await updatePubsubBroker({ accountId, apiToken, namespaceName, brokerName, expiration, onPublishUrl });
    });

    add(apiCommand('list-pubsub-broker-public-keys', 'List the public keys for a Pub/Sub broker').arg('name', 'string', 'Name of the namespace').arg('brokerName', 'string', 'Name of the broker'), async (accountId, apiToken, opts) => {
        const { name: namespaceName, brokerName } = opts;
        const value = await listPubsubBrokerPublicKeys({ accountId, apiToken, namespaceName, brokerName });
        console.log(JSON.stringify(value, undefined, 2));
    });

    add(apiCommand('get-pubsub-broker', 'Get a Pub/Sub broker').arg('name', 'string', 'Name of the namespace').arg('brokerName', 'string', 'Name of the broker'), async (accountId, apiToken, opts) => {
        const { name: namespaceName, brokerName } = opts;
        const value = await getPubsubBroker({ accountId, apiToken, namespaceName, brokerName });
        console.log(JSON.stringify(value, undefined, 2));
    });

    add(apiCommand('delete-pubsub-broker', 'Delete a Pub/Sub broker').arg('name', 'string', 'Name of the namespace').arg('brokerName', 'string', 'Name of the broker'), async (accountId, apiToken, opts) => {
        const { name: namespaceName, brokerName } = opts;
        await deletePubsubBroker({ accountId, apiToken, namespaceName, brokerName });
    });

    add(apiCommand('generate-pubsub-credentials', 'Generate credentials for a Pub/Sub broker').arg('name', 'string', 'Name of the namespace').arg('brokerName', 'string', 'Name of the broker').option('number', 'integer', 'Number of credentials to generate').option('clientId', 'strings', 'Explicit clientId (otherwise generated)').option('expiration', 'integer', 'Expiration for the generated credentials (in seconds)'), async (accountId, apiToken, opts) => {
        const { name: namespaceName, brokerName, number = 1, clientId: clientIds, expiration } = opts;
        const value = await generatePubsubCredentials({ accountId, apiToken, namespaceName, brokerName, number, type: 'TOKEN', topicAcl: '#', clientIds, expiration });
        console.log(JSON.stringify(value, undefined, 2));
    });

    add(apiCommand('revoke-pubsub-credentials', 'Revoke credentials for a Pub/Sub broker').arg('name', 'string', 'Name of the namespace').arg('brokerName', 'string', 'Name of the broker').option('jti', 'strings', 'JWT ids'), async (accountId, apiToken, opts) => {
        const { name: namespaceName, brokerName, jti: jwtIds = [] } = opts;
        await revokePubsubCredentials({ accountId, apiToken, namespaceName, brokerName, jwtIds });
    });

    add(apiCommand('list-pubsub-revocations', 'List revocations for a Pub/Sub broker').arg('name', 'string', 'Name of the namespace').arg('brokerName', 'string', 'Name of the broker'), async (accountId, apiToken, opts) => {
        const { name: namespaceName, brokerName } = opts;
        const value = await listPubsubRevocations({ accountId, apiToken, namespaceName, brokerName });
        console.log(JSON.stringify(value, undefined, 2));
    });

    add(apiCommand('delete-pubsub-revocations', 'Delete revocations for a Pub/Sub broker').arg('name', 'string', 'Name of the namespace').arg('brokerName', 'string', 'Name of the broker').option('jti', 'strings', 'JWT ids'), async (accountId, apiToken, opts) => {
        const { name: namespaceName, brokerName, jti: jwtIds = [] } = opts;
        const value = await deletePubsubRevocations({ accountId, apiToken, namespaceName, brokerName, jwtIds });
        console.log(JSON.stringify(value, undefined, 2));
    });

    add(apiCommand('query-analytics-engine', '').arg('sql', 'string', 'Query'), async (accountId, apiToken, opts) => {
        const { sql: query } = opts;
        const result = await queryAnalyticsEngine({ accountId, apiToken, query });
        if (result.startsWith('{')) {
            console.log(JSON.stringify(JSON.parse(result), undefined, 2));
        } else {
            console.log(result);
        }
    });

    add(apiCommand('list-trace-workers', ''), async (accountId, apiToken) => {
        const result = await listTraceWorkers({ accountId, apiToken });
        console.log(result);
    });

    add(apiCommand('set-trace-worker', '').arg('producerScript', 'string', 'Producer script name').arg('consumerService', 'string', 'Consumer service name'), async (accountId, apiToken, opts) => {
        const { producerScript, consumerService } = opts;
        const result = await setTraceWorker({ accountId, apiToken, producerScript, consumerService });
        console.log(result);
    });

    add(apiCommand('delete-trace-worker', '').arg('tag', 'string', 'Unique tag of the trace worker pair'), async (accountId, apiToken, opts) => {
        const { tag } = opts;
        const result = await deleteTraceWorker({ accountId, apiToken, tag });
        console.log(result);
    });

    add(apiCommand('list-user-billing-history', ''), async (_accountId, apiToken) => {
        const result = await listUserBillingHistory({ apiToken });
        console.log(result);
    });

    add(apiCommand('list-queues', '').option('page', 'integer', 'Page number'), async (accountId, apiToken, opts) => {
        const { page } = opts;
        const result = await listQueues({ accountId, apiToken, page });
        console.log(JSON.stringify(result, undefined, 2));
    });

    add(apiCommand('create-queue', '').arg('queueName', 'string', 'Queue name'), async (accountId, apiToken, opts) => {
        const { queueName } = opts;
        const result = await createQueue({ accountId, apiToken, queueName });
        console.log(result);
    });

    add(apiCommand('get-queue', '').arg('queueName', 'string', 'Queue name'), async (accountId, apiToken, opts) => {
        const { queueName } = opts;
        const result = await getQueue({ accountId, apiToken, queueName });
        console.log(result);
    });

    add(apiCommand('delete-queue', '').arg('queueName', 'string', 'Queue name'), async (accountId, apiToken, opts) => {
        const { queueName } = opts;
        await deleteQueue({ accountId, apiToken, queueName });
    });

    add(apiCommand('put-queue-consumer', '').arg('queueName', 'string', 'Queue name').arg('scriptName', 'string', 'Script name').option('envName', 'string', 'Environment name')
            .option('batchSize', 'integer', 'The maximum number of messages allowed in each batch')
            .option('maxRetries', 'integer', 'The maximum number of retries for a message, if it fails or retryAll() is invoked')
            .option('maxWaitTimeMillis', 'integer', 'The maximum number of millis to wait until a batch is full')
            .option('deadLetterQueue', 'string', 'Name of the dead letter queue')
            , async (accountId, apiToken, opts) => {
        const { queueName, scriptName, envName, batchSize, maxRetries, maxWaitTimeMillis } = opts;
        const result = await putQueueConsumer({ accountId, apiToken, queueName, scriptName, envName, batchSize, maxRetries, maxWaitTimeMillis });
        console.log(result);
    });

    add(apiCommand('delete-queue-consumer', '').arg('queueName', 'string', 'Queue name').arg('scriptName', 'string', 'Script name').option('envName', 'string', 'Environment name'), async (accountId, apiToken, opts) => {
        const { queueName, scriptName, envName } = opts;
        await deleteQueueConsumer({ accountId, apiToken, queueName, scriptName, envName });
    });

    add(apiCommand('get-worker-service-metadata', '').arg('scriptName', 'string', 'Script name'), async (accountId, apiToken, opts) => {
        const { scriptName } = opts;
        const result = await getWorkerServiceMetadata({ accountId, apiToken, scriptName });
        console.log(result);
    });

    add(apiCommand('list-worker-deployments', '').arg('script', 'string', 'Script name or tag'), async (accountId, apiToken, opts) => {
        const { script } = opts;
        const scriptTag = /^[0-9a-f]{32}$/.test(script) ? script : (await getWorkerServiceMetadata({ accountId, apiToken, scriptName: script })).default_environment.script.tag;
        if (!scriptTag) throw new Error(`Unable to find script: ${script}`);
        const result = await listWorkerDeployments({ accountId, apiToken, scriptTag });
        console.log(JSON.stringify(result, undefined, 2));
    });

    return rt;
}

function makeSubcommandHandler<T>(cliCommand: CliCommand<T>, apiHandler: ApiHandler<T>): SubcommandHandler {
    return async (args, options) => {
        if (cliCommand.dumpHelp(args, options)) return;

        const { accountId, apiToken } = await loadApiCredentials(options);
        await apiHandler(accountId, apiToken, cliCommand.parse(args, options), options);
    };
}

async function loadApiCredentials(options: Record<string, unknown>): Promise<{ accountId: string, apiToken: string }> {
    const config = await loadConfig(options);
    const { accountId, apiToken: apiTokenFromProfile } = await resolveProfile(config, options);
    if (options.verbose) CloudflareApi.DEBUG = true;
    const apiTokenFromOption = parseOptionalStringOption('api-token', options);
    const apiToken = apiTokenFromOption ?? apiTokenFromProfile;
    return { accountId, apiToken };
}

function commandOptionsForParsePagingOptions(command: CliCommand<unknown>) {
    return command
        .optionGroup()
        .option('page', 'integer', 'Result page number')
        .option('perPage', 'integer', 'Results per page')
        .option('direction', 'enum', 'Sort order for the results', { value: 'asc' }, { value: 'desc' })
        ;
}

function parsePagingOptions(options: Record<string, unknown>): { page?: number, perPage?: number, direction?: 'asc' | 'desc' }  {
    const page = parseOptionalIntegerOption('page', options);
    const perPage = parseOptionalIntegerOption('per-page', options);
    const direction = parseOptionalStringOption('direction', options); if (typeof direction === 'string' && direction !== 'asc' && direction !== 'desc') throw new Error(`Bad direction: ${direction}`);
    return { page, perPage, direction };
}
