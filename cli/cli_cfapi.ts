import { commandOptionsForConfig, loadConfig, resolveProfile } from './config_loader.ts';
import { CloudflareApi, HyperdriveOriginInput, createHyperdriveConfig, createLogpushJob, createPubsubBroker, createPubsubNamespace, createQueue, createR2Bucket, deleteHyperdriveConfig, deleteLogpushJob, deletePubsubBroker, deletePubsubNamespace, deletePubsubRevocations, deleteQueue, deleteQueueConsumer, deleteR2Bucket, deleteTraceWorker, deleteWorkersDomain, generatePubsubCredentials, getAccountDetails, getAsnOverview, getAsns, getKeyMetadata, getKeyValue, getPubsubBroker, getQueue, getR2BucketUsageSummary, getUser, getWorkerAccountSettings, getWorkerServiceMetadata, getWorkerServiceScript, getWorkerServiceSubdomainEnabled, getWorkersSubdomain, listAccounts, listDurableObjects, listDurableObjectsNamespaces, listFlags, listHyperdriveConfigs, listKVNamespaces, listKeys, listLogpushJobs, listMemberships, listAiModels, listPubsubBrokerPublicKeys, listPubsubBrokers, listPubsubNamespaces, listPubsubRevocations, listQueues, listR2Buckets, listScripts, listTraceWorkers, listUserBillingHistory, listWorkerDeployments, listWorkersDomains, listZones, putKeyValue, putQueueConsumer, putWorkerAccountSettings, putWorkersDomain, queryAnalyticsEngine, revokePubsubCredentials, runAiModel, setTraceWorker, setWorkerServiceSubdomainEnabled, updateHyperdriveConfig, updateLogpushJob, updatePubsubBroker, verifyToken, listWorkerVersionedDeployments, updateScriptVersionAllocation, Rule, ackQueueMessages, queryKvRequestAnalytics, queryKvStorageAnalytics } from '../common/cloudflare_api.ts';
import { check, checkMatchesReturnMatcher } from '../common/check.ts';
import { Bytes } from '../common/bytes.ts';
import { denoflareCliCommand, parseOptionalIntegerOption, parseOptionalStringOption } from './cli_common.ts';
import { CliCommand, SubcommandHandler } from './cli_command.ts';
import { getScriptSettings } from '../common/cloudflare_api.ts';
import { listZoneRulesets } from '../common/cloudflare_api.ts';
import { updateZoneEntrypointRuleset } from '../common/cloudflare_api.ts';
import { AiImageClassificationInput, AiImageToTextInput, AiModelInput, AiObjectDetectionInput, AiSentenceSimilarityInput, AiSpeechRecognitionInput, AiSummarizationInput, AiTextClassificationInput, AiTextEmbeddingsInput, AiTextGenerationInput, AiTextToImageInput, AiTranslationInput } from '../common/cloudflare_workers_types.d.ts';
import { TextLineStream } from './deps_cli.ts';
import { pullQueueMessages } from '../common/cloudflare_api.ts';

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

    add(apiCommand('get-script-settings', 'Get Worker script settings')
        .arg('scriptName', 'string', 'Worker name')
    , async (accountId, apiToken, opts) => {
        const { scriptName } = opts;
        const value = await getScriptSettings({ accountId, scriptName, apiToken });
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

    add(apiCommand('list-keys', `List a KV namespace's keys`)
        .arg('namespaceId', 'string', 'KV namespace id')
        .option('cursor', 'string', 'Token indicating the position from which to continue')
        .option('prefix', 'string', 'Used to filter down which keys will be returned')
        .option('limit', 'integer', 'The number of keys to return')
    , async (accountId, apiToken, opts) => {
        const { namespaceId, cursor, prefix, limit } = opts;
        const res = await listKeys({ accountId, namespaceId, cursor, prefix, limit, apiToken });
        for (const item of res.result) {
            console.log(JSON.stringify(item));
        }
        console.log(JSON.stringify(res.result_info));
    });

    add(apiCommand('list-kv-namespaces', `List KV namespaces`)
        .option('direction', 'enum', 'Direction to order namespaces', { value: 'asc' }, { value: 'desc' })
        .option('order', 'enum', 'Field to order results by', { value: 'id' }, { value: 'title' })
        .option('page', 'integer', 'Page number of paginated results')
        .option('perPage', 'integer', 'Maximum number of results per page')
    , async (accountId, apiToken, opts) => {
        const { direction, order, page, perPage: per_page } = opts;
        if (typeof direction === 'string' && !(direction === 'asc' || direction === 'desc')) throw new Error();
        if (typeof order === 'string' && !(order === 'id' || order === 'title')) throw new Error();
        const res = await listKVNamespaces({ accountId, apiToken, direction, order, page, per_page });
        for (const item of res.result) {
            console.log(JSON.stringify(item));
        }
        console.log(JSON.stringify(res.result_info));
    });
    
    add(apiCommand('query-kv-request-analytics', `Query KV request metrics`)
        .option('limit', 'integer', 'Limit number of returned metrics')
        .option('since', 'string', 'Start of time interval to query, defaults to 6 hours ago')
        .option('until', 'string', 'End of time interval to query, defaults to now')
        .option('dimensions', 'strings', 'Can be used to break down the data by: accountId, responseCode, requestType')
        .option('filters', 'string', 'Used to filter rows by one or more dimensions. Filters can be combined using OR and AND boolean logic')
        .option('metrics', 'strings', 'One or more metrics to compute: requests, writeKiB, readKiB')
        .option('sort', 'strings', 'Array of dimensions or metrics to sort by, may be prefixed by - (descending) or + (ascending')
    , async (accountId, apiToken, opts) => {
        const { limit, since, until, dimensions, filters, metrics, sort } = opts;
        const res = await queryKvRequestAnalytics({ accountId, apiToken, limit, since, until, dimensions, filters, metrics, sort });
        console.log(JSON.stringify(res, undefined, 2));
    });

    add(apiCommand('query-kv-storage-analytics', `Query KV storage metrics`)
        .option('limit', 'integer', 'Limit number of returned metrics')
        .option('since', 'string', 'Start of time interval to query, defaults to 6 hours ago')
        .option('until', 'string', 'End of time interval to query, defaults to now')
        .option('dimensions', 'strings', 'Can be used to break down the data by: namespaceId')
        .option('filters', 'string', 'Used to filter rows by one or more dimensions. Filters can be combined using OR and AND boolean logic')
        .option('metrics', 'strings', 'One or more metrics to compute: storedBytes, storedKeys')
        .option('sort', 'strings', 'Array of dimensions or metrics to sort by, may be prefixed by - (descending) or + (ascending')
    , async (accountId, apiToken, opts) => {
        const { limit, since, until, dimensions, filters, metrics, sort } = opts;
        const res = await queryKvStorageAnalytics({ accountId, apiToken, limit, since, until, dimensions, filters, metrics, sort });
        console.log(JSON.stringify(res, undefined, 2));
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

    add(apiCommand('get-account-details', 'Get account details'), async (accountId, apiToken) => {
        const value = await getAccountDetails({ accountId, apiToken });
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

    rt.subcommandGroup();

    add(apiCommand('list-queues', 'Returns the queues owned by an account').option('page', 'integer', 'Page number'), async (accountId, apiToken, opts) => {
        const { page } = opts;
        const result = await listQueues({ accountId, apiToken, page });
        console.log(JSON.stringify(result, undefined, 2));
    });

    add(apiCommand('create-queue', 'Creates a new queue').arg('queueName', 'string', 'Queue name'), async (accountId, apiToken, opts) => {
        const { queueName } = opts;
        const result = await createQueue({ accountId, apiToken, queueName });
        console.log(result);
    });

    add(apiCommand('get-queue', 'Get information about a specific queue').arg('queueName', 'string', 'Queue name'), async (accountId, apiToken, opts) => {
        const { queueName } = opts;
        const result = await getQueue({ accountId, apiToken, queueName });
        console.log(result);
    });

    add(apiCommand('delete-queue', 'Deletes a queue').arg('queueName', 'string', 'Queue name'), async (accountId, apiToken, opts) => {
        const { queueName } = opts;
        await deleteQueue({ accountId, apiToken, queueName });
    });

    add(apiCommand('put-queue-consumer', 'Creates a new consumer for a queue').arg('queueName', 'string', 'Queue name').arg('scriptName', 'string', 'Script name').option('envName', 'string', 'Environment name')
            .option('batchSize', 'integer', 'The maximum number of messages allowed in each batch')
            .option('maxRetries', 'integer', 'The maximum number of retries for a message, if it fails or retryAll() is invoked')
            .option('maxWaitTimeMillis', 'integer', 'The maximum number of millis to wait until a batch is full')
            .option('maxConcurrency', 'integer', 'If present, the maximum concurrent consumer invocations (between 1 and 20)')
            .option('deadLetterQueue', 'string', 'Name of the dead letter queue')
            , async (accountId, apiToken, opts) => {
        const { queueName, scriptName, envName, batchSize, maxRetries, maxWaitTimeMillis } = opts;
        const result = await putQueueConsumer({ accountId, apiToken, queueName, scriptName, envName, batchSize, maxRetries, maxWaitTimeMillis });
        console.log(result);
    });

    add(apiCommand('delete-queue-consumer', 'Deletes the consumer for a queue').arg('queueName', 'string', 'Queue name').arg('scriptName', 'string', 'Script name').option('envName', 'string', 'Environment name'), async (accountId, apiToken, opts) => {
        const { queueName, scriptName, envName } = opts;
        await deleteQueueConsumer({ accountId, apiToken, queueName, scriptName, envName });
    });

    add(apiCommand('pull-queue-messages', 'Pulls queue messages').arg('queueId', 'string', 'Queue ID').option('batchSize', 'integer', 'Wait till this number of messages are available').option('visibilityTimeout', 'integer', 'How long you have to acknowledge the message'), async (accountId, apiToken, opts) => {
        const { queueId, batchSize, visibilityTimeout } = opts;
        const result = await pullQueueMessages({ accountId, apiToken, queueId, batchSize, visibilityTimeout });
        console.log(result);
    });

    add(apiCommand('ack-queue-messages', 'Acknowledge or retry queue messages').arg('queueId', 'string', 'Queue ID'), async (accountId, apiToken, opts) => {
        const { queueId } = opts;

        const result = await ackQueueMessages({ accountId, apiToken, queueId, acks: [], retries: [] }); // TODO
        console.log(result);
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

    add(apiCommand('list-worker-versioned-deployments', '').arg('script', 'string', 'Script name'), async (accountId, apiToken, opts) => {
        const { script: scriptName } = opts;
        const result = await listWorkerVersionedDeployments({ accountId, apiToken, scriptName });
        console.log(JSON.stringify(result, undefined, 2));
    });

    add(apiCommand('update-worker-version-allocation', '').arg('script', 'string', 'Script name').arg('allocations', 'strings', 'version-id:pct'), async (accountId, apiToken, opts) => {
        const { script: scriptName, allocations } = opts;
        const percentages: Record<string, number> = (() => {
            if (allocations.length === 0) throw new Error(`Provide version, or version:pct pairs`);
            let remainderVersion: string | undefined;
            const rt: Record<string, number> = {};
            for (const allocation of allocations) {
                const [ _, version, __, pctStr ] = checkMatchesReturnMatcher('allocation', allocation, /^([0-9a-f-]+)(:(\d+(\.\d+)?))?$/);
                if (pctStr === undefined) {
                    if (remainderVersion) throw new Error(`Can only provide one remainder version (a version without a percentage)`);
                    remainderVersion = version;
                } else {
                    rt[version] = parseFloat(pctStr);
                }
            }
            const sum = Object.values(rt).reduce((a, b) => a + b);
            if (sum > 100) throw new Error('Allocations cannot exceed 100%');

            if (remainderVersion) {
                rt[remainderVersion] = 100 - sum;
            }
            return rt;
        })();
        const result = await updateScriptVersionAllocation({ accountId, apiToken, scriptName, percentages });
        console.log(JSON.stringify(result, undefined, 2));
    });

    add(apiCommand('get-worker-script', '').arg('scriptName', 'string', 'Script name').option('environment', 'string', 'Service environment name (defaults to production)'), async (accountId, apiToken, opts) => {
        const { scriptName, environment = 'production' } = opts;
        const result = await getWorkerServiceScript({ accountId, apiToken, scriptName, environment });
        const trimTo = 1000;
        for (const [name, value] of result) {
            console.log(name);
            if (typeof value === 'string') {
                console.log(value.length > trimTo ? `${value.substring(0, trimTo)}... (${value.length} bytes)` : value);
            } else {
                throw new Error(`Unimplemented value: ${value}`);
            }
        }
    });

    rt.subcommandGroup();
    
    add(apiCommand('list-logpush-jobs', '').option('page', 'integer', 'Page number'), async (accountId, apiToken, opts) => {
        const { page } = opts;
        const result = await listLogpushJobs({ accountId, apiToken, page });
        console.log(JSON.stringify(result, undefined, 2));
    });

    add(apiCommand('create-logpush-job', 'Create a Logpush job')
            .arg('name', 'string', 'Name of the job')
            .option('logpullOptions', 'required-string', 'Configuration string, specifies things like requested fields and timestamp formats')
            .option('filter', 'string', 'Filter json')
            .option('destinationConfiguration', 'required-string', 'Uniquely identifies a resource (such as an s3 bucket) where data will be pushed')
            .option('dataset', 'required-string', 'Dataset to be pulled')
            .option('enabled', 'boolean', 'Indicates if the job should be enabled')
            , async (accountId, apiToken, opts) => {
        const { name, logpullOptions, filter, destinationConfiguration, dataset, enabled = true } = opts;
        const value = await createLogpushJob({ accountId, apiToken, name, logpullOptions, filter, destinationConfiguration, dataset, enabled });
        console.log(value);
    });

    add(apiCommand('update-logpush-job', 'Update a Logpush job')
            .arg('jobId', 'string', 'Job id')
            .option('logpullOptions', 'string', 'Configuration string, specifies things like requested fields and timestamp formats')
            .option('filter', 'string', 'Filter json')
            .option('destinationConfiguration', 'string', 'Uniquely identifies a resource (such as an s3 bucket) where data will be pushed')
            .option('frequency', 'string', 'high: larger quantities of smaller files, low: smaller quantities of larger files')
            .option('enabled', 'boolean', 'Indicates if the job should be enabled')
            , async (accountId, apiToken, opts) => {
        const { jobId: jobIdStr, logpullOptions, filter, destinationConfiguration, frequency, enabled } = opts;
        const jobId = parseInt(jobIdStr);
        const value = await updateLogpushJob({ accountId, apiToken, jobId, logpullOptions, filter, destinationConfiguration, frequency, enabled });
        console.log(value);
    });

    add(apiCommand('delete-logpush-job', 'Delete a Logpush job').arg('jobId', 'string', 'Job id'), async (accountId, apiToken, opts) => {
        const { jobId: jobIdStr } = opts;
        const jobId = parseInt(jobIdStr);
        const value = await deleteLogpushJob({ accountId, apiToken, jobId });
        console.log(value);
    });

    add(apiCommand('get-asn', '').arg('asn', 'string', 'ASN'), async (accountId, apiToken, opts) => {
        const { asn: asnStr } = opts;
        const asn = parseInt(asnStr);
        const value = await getAsnOverview({ accountId, apiToken, asn });
        console.log(value);
    });

    add(apiCommand('get-asns', '').arg('asns', 'string', 'ASN'), async (_accountId, apiToken, opts) => {
        const { asns: asnsStr } = opts;
        const asns = asnsStr.split(',').map(v => parseInt(v));
        const value = await getAsns({ apiToken, asns });
        console.log(value);
    });

    rt.subcommandGroup();

    add(apiCommand('list-ai-models', 'List available AI models'), async (accountId, apiToken, _opts) => {
        const value = await listAiModels({ apiToken, accountId });
        console.log(value);
    });

    add(apiCommand('run-ai-model', 'Run a specific AI model on-demand')
            .arg('model', 'string', '')
            .option('prompt', 'string', '')
            .option('system', 'strings', '')
            .option('user', 'strings', '')
            .option('text', 'string', '')
            .option('texts', 'strings', '')
            .option('from', 'string', '')
            .option('to', 'string', '')
            .option('url', 'string', '')
            .option('file', 'string', '')
            .option('steps', 'integer', '')
            .option('max', 'integer', '')
            .option('stream', 'boolean', '')
            .option('imageFile', 'string', '')
            .option('imageUrl', 'string', '')
            , async (accountId, apiToken, opts) => {
        const { model, prompt, system, user, text, from, to, texts, url, file, steps: num_steps = 20, max, stream, imageFile, imageUrl } = opts;
        let responseType: 'json' | 'bytes' | 'sse' = 'json';
        const readUrlOrFile = async (mode?: 'image'): Promise<Uint8Array> => {
            const urlParam = mode === 'image' ? imageUrl : url;
            const fileParam = mode === 'image' ? imageFile : file;
            if (typeof urlParam === 'string') return new Uint8Array(await (await fetch(urlParam)).arrayBuffer());
            if (typeof fileParam === 'string') return await Deno.readFile(fileParam);
            throw new Error(`Provide '${urlParam}' or '${fileParam}' option`);
        };
        const readUrlOrFileAsNumberArray = async (mode?: 'image') => [ ...await readUrlOrFile(mode) ];

        const parseAiTextGenerationInput = (): AiTextGenerationInput => {
            if (stream) responseType = 'sse';
            if (typeof prompt === 'string') return { stream, prompt };
            if (system !== undefined || user !== undefined) return { stream, messages: [ ...(system ?? []).map(v => ({ role: 'system', content: v })), ...(user ?? []).map(v => ({ role: 'user', content: v })) ] };
            throw new Error(`Provide 'prompt' or 'system' or 'user' options`);
        };
        const parseAiTranslationInput = (): AiTranslationInput => {
            if (typeof text !== 'string') throw new Error(`Missing 'text' option`);
            if (typeof to !== 'string') throw new Error(`Missing 'to' option`);
            return { text, target_lang: to, source_lang: from };
        };
        const parseAiTextClassificationInput = (): AiTextClassificationInput => {
            if (typeof text !== 'string') throw new Error(`Missing 'text' option`);
            return { text };
        };
        const parseAiTextEmbeddingsInput = (): AiTextEmbeddingsInput => {
            if (typeof text === 'string') return { text };
            if (texts !== undefined) return { text: texts };
            throw new Error(`Provide 'text' or 'texts' options`);
        };
        const parseAiImageClassificationInput = async (): Promise<AiImageClassificationInput> => {
            const image = await readUrlOrFileAsNumberArray();
            return { image };
        };
        const parseAiObjectDetectionInput = async (): Promise<AiObjectDetectionInput> => {
            const image = await readUrlOrFileAsNumberArray();
            return { image };
        };
        const parseAiSpeechRecognitionInput = async (): Promise<AiSpeechRecognitionInput> => {
            const audio = await readUrlOrFileAsNumberArray();
            return { audio };
        };
        const parseAiTextToImageInput = async (): Promise<AiTextToImageInput> => {
            if (typeof prompt !== 'string') throw new Error(`Missing 'prompt' option`);
            if (typeof file !== 'string') throw new Error(`Missing 'file' option`);
            const imageArr = (typeof imageFile === 'string' || typeof imageUrl === 'string')?  await readUrlOrFileAsNumberArray('image') : undefined;
            responseType = 'bytes';
            return {
                prompt,
                image: imageArr,
                num_steps,
            };
        };
        const parseAiSentenceSimilarityInput = (): AiSentenceSimilarityInput => {
            if (typeof text !== 'string') throw new Error(`Missing 'text' option`);
            const source = text;
            const sentences = texts ?? [];
            return { source, sentences };
        };
        const parseAiSummarizationInput = (): AiSummarizationInput => {
            if (typeof text !== 'string') throw new Error(`Missing 'text' option`);
            return { input_text: text, max_length: max };
        };
        const parseAiImageToTextInput = async (): Promise<AiImageToTextInput> => {
            const image = await readUrlOrFileAsNumberArray();
            return { image, prompt, max_tokens: max };
        };
        const models: Record<string, [ string[], () => AiModelInput | Promise<AiModelInput> ]> = {
            '@cf/huggingface/distilbert-sst-2-int8': [ [ 'text-classification' ], parseAiTextClassificationInput ],
            '@cf/jpmorganchase/roberta-spam': [ [ 'text-classification-spam' ], parseAiTextClassificationInput ],

            '@cf/stabilityai/stable-diffusion-xl-base-1.0': [ [ 'text-to-image', 'stable-diffusion-base' ], parseAiTextToImageInput ],
            '@cf/bytedance/stable-diffusion-xl-lightning': [ [ 'text-to-image', 'stable-diffusion-lightning' ], parseAiTextToImageInput ],
            '@cf/runwayml/stable-diffusion-v1-5-inpainting': [ [ 'text-to-image', 'stable-diffusion-inpainting' ], parseAiTextToImageInput ],
            '@cf/runwayml/stable-diffusion-v1-5-img2img': [ [ 'text-to-image', 'stable-diffusion-img2img' ], parseAiTextToImageInput ],
            '@cf/lykon/dreamshaper-8-lcm': [ [ 'text-to-image', 'dreamshaper' ], parseAiTextToImageInput ],

            '@hf/sentence-transformers/all-minilm-l6-v2': [ [ 'sentence-similarity' ], parseAiSentenceSimilarityInput ],

            '@cf/baai/bge-small-en-v1.5': [ [ 'text-embeddings-small' ], parseAiTextEmbeddingsInput ],
            '@cf/baai/bge-base-en-v1.5': [ [ 'text-embeddings' ], parseAiTextEmbeddingsInput ],
            '@cf/baai/bge-large-en-v1.5': [ [ 'text-embeddings-large' ], parseAiTextEmbeddingsInput ],
            '@hf/baai/bge-base-en-v1.5': [ [ 'text-embeddings-hf-base' ], parseAiTextEmbeddingsInput ],

            '@cf/openai/whisper': [ [ 'speech-recognition', 'whisper' ], parseAiSpeechRecognitionInput ],

            '@cf/microsoft/resnet-50': [ [ 'image-classification' ], parseAiImageClassificationInput ],

            '@cf/facebook/detr-resnet-50': [ [ 'object-detection' ], parseAiObjectDetectionInput ],

            '@cf/meta/llama-2-7b-chat-int8': [ [ 'llama', 'text-generation' ], parseAiTextGenerationInput ],
            '@cf/microsoft/phi-2': [ [ 'phi2' ], parseAiTextGenerationInput ],
            '@cf/mistral/mistral-7b-instruct-v0.1': [ [ 'mistral' ], parseAiTextGenerationInput ],
            ...Object.fromEntries([
                // '@cf/meta/llama-2-7b-chat-int8',
                // '@cf/mistral/mistral-7b-instruct-v0.1' ,
                '@cf/meta/llama-2-7b-chat-fp16' ,
                '@hf/thebloke/llama-2-13b-chat-awq' ,
                '@hf/thebloke/zephyr-7b-beta-awq' ,
                '@hf/thebloke/mistral-7b-instruct-v0.1-awq' ,
                '@hf/thebloke/codellama-7b-instruct-awq',
                '@hf/thebloke/openchat_3.5-awq' ,
                '@hf/thebloke/openhermes-2.5-mistral-7b-awq' ,
                '@hf/thebloke/starling-lm-7b-alpha-awq' ,
                '@hf/thebloke/orca-2-13b-awq' ,
                '@hf/thebloke/neural-chat-7b-v3-1-awq' ,
                '@hf/thebloke/llamaguard-7b-awq' ,
                '@hf/thebloke/deepseek-coder-6.7b-base-awq' ,
                '@hf/thebloke/deepseek-coder-6.7b-instruct-awq',
                '@cf/deepseek-ai/deepseek-math-7b-base',
                '@cf/deepseek-ai/deepseek-math-7b-instruct',
                '@cf/defog/sqlcoder-7b-2',
                '@cf/openchat/openchat-3.5-0106',
                '@cf/tiiuae/falcon-7b-instruct',
                '@cf/thebloke/discolm-german-7b-v1-awq',
                '@cf/qwen/qwen1.5-0.5b-chat',
                '@cf/qwen/qwen1.5-1.8b-chat',
                '@cf/qwen/qwen1.5-7b-chat-awq',
                '@cf/qwen/qwen1.5-14b-chat-awq',
                '@cf/tinyllama/tinyllama-1.1b-chat-v1.0',
                // '@cf/microsoft/phi-2',
                '@cf/thebloke/yarn-mistral-7b-64k-awq',
            ].map(v => [ v, [ [ ], parseAiTextGenerationInput ] ])),

            '@cf/meta/m2m100-1.2b': [ [ 'translation' ], parseAiTranslationInput ],

            '@cf/facebook/bart-large-cnn': [ [ 'summarization' ], parseAiSummarizationInput ],

            '@cf/unum/uform-gen2-qwen-500m': [ [ 'image-to-text' ], parseAiImageToTextInput ],
        };

        const entry = Object.entries(models).find(v => v[0] === model || v[1][0].includes(model));
        if (!entry) throw new Error(`Unsupported model: ${model}, valid values: ${[ ...Object.keys(models), ...Object.values(models).flatMap(v => v[0]) ].join(', ')}`);
        const [ modelId, [ _aliases, parser ] ] = entry;
        const input = await parser();
        const value = await runAiModel({ apiToken, accountId, modelId, input, responseType });
        if (value instanceof Uint8Array) {
            if (file) {
                await Deno.writeFile(file, value);
                console.log(`Wrote ${value.length} bytes to ${file}`);
            }
        } else if (value instanceof ReadableStream) {
            const encoder = new TextEncoder();
            for await (const line of value.pipeThrough(new TextDecoderStream()).pipeThrough(new TextLineStream())) {
                const m = /^data:\s+({.*?})$/.exec(line);
                if (!m) continue;
                const { response } = JSON.parse(m[1]);
                await Deno.stdout.write(encoder.encode(response));
            }
            await Deno.stdout.write(encoder.encode('\n'));
        } else {
            console.log(JSON.stringify(value, undefined, 2));
        }
    });

    add(apiCommand('list-hyperdrive-configs', ''), async (accountId, apiToken, _opts) => {
        const value = await listHyperdriveConfigs({ apiToken, accountId });
        console.log(value);
    });
    
    add(apiCommand('create-hyperdrive-config', '')
            .arg('name', 'string', 'Name of the config')
            .arg('connectionString', 'string', 'Connection string to the database')
            .option('disabled', 'boolean', '')
            .option('maxAge', 'integer', '')
            .option('staleWhileRevalidate', 'integer', '')
        , async (accountId, apiToken, opts) => {
        const { name, connectionString, disabled, maxAge, staleWhileRevalidate } = opts;
        const origin = parseHyperdriveOriginFromConnectionString(connectionString);
        const value = await createHyperdriveConfig({ accountId, apiToken, name, origin, caching: { disabled, maxAge, staleWhileRevalidate } });
        console.log(value);
    });

    add(apiCommand('update-hyperdrive-config', '')
            .arg('id', 'string', 'ID of the config')
            .arg('name', 'string', 'Name of the config')
            .arg('connectionString', 'string', 'Connection string to the database')
            .option('disabled', 'boolean', '')
            .option('maxAge', 'integer', '')
            .option('staleWhileRevalidate', 'integer', '')
        , async (accountId, apiToken, opts) => {
        const { id, name, connectionString, disabled, maxAge, staleWhileRevalidate } = opts;
        const origin = parseHyperdriveOriginFromConnectionString(connectionString);
        const value = await updateHyperdriveConfig({ accountId, apiToken, id, name, origin, caching: { disabled, maxAge, staleWhileRevalidate } });
        console.log(value);
    });

    add(apiCommand('delete-hyperdrive-config', '')
            .arg('id', 'string', 'ID of the config')
        , async (accountId, apiToken, opts) => {
        const { id } = opts;
        const value = await deleteHyperdriveConfig({ accountId, apiToken, id });
        console.log(value);
    });

    rt.subcommandGroup();

    add(apiCommand('list-zone-rulesets', 'List rulesets for a zone').arg('zoneId', 'string', 'ID of the zone'), async (_accountId, apiToken, opts) => {
        const { zoneId } = opts;
        const value = await listZoneRulesets({ apiToken, zoneId });
        console.log(value);
    });

    add(apiCommand('create-custom-error-response', 'Create a custom error rule for a zone')
            .arg('zoneId', 'string', 'ID of the zone')
            .option('status', 'required-integer', 'HTTP response code')
            .option('content', 'required-string', 'HTTP response content')
            .option('contentType', 'required-string', 'HTTP response content-type')
            .option('hostname', 'string', 'Limit to specific hostname/subdomain')
        , async (_accountId, apiToken, opts) => {
        const { zoneId, status, content, contentType, hostname } = opts;
        const rulesetPhase = 'http_custom_errors';
        const rules: Rule[] = [
            {
                action: 'serve_error',
                action_parameters: {
                    content,
                    content_type: contentType,
                },
                expression: `http.response.code eq ${status}${hostname ? ` and http.host eq "${hostname}"` : ''}`,
                enabled: true,
            }
        ]
        const value = await updateZoneEntrypointRuleset({ apiToken, zoneId, rulesetPhase, rules });
        console.log(value);
    });

    return rt;
}

function parseHyperdriveOriginFromConnectionString(connectionString: string): HyperdriveOriginInput {
    const { username: user, password, protocol, hostname: host, port: portStr, pathname } = new URL(connectionString);
    const port = parseInt(portStr);
    const scheme = checkMatchesReturnMatcher('scheme', protocol, /^([a-z0-9]+):$/)[1];
    const database = checkMatchesReturnMatcher('pathname', pathname, /^\/([^/]+)$/)[1];
    return  { scheme, user, password, host, port, database };
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
