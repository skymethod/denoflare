import { createTail, sendTailHeartbeat } from '../common/cloudflare_api.ts';
import { commandOptionsForConfig, loadConfig, resolveProfile } from './config_loader.ts';
import { isTailMessageCronEvent, Outcome, parseHeaderFilter, TailFilter, TailMessage } from '../common/tail.ts';
import { TailConnection, TailConnectionCallbacks } from '../common/tail_connection.ts';
import { dumpMessagePretty } from '../common/tail_pretty.ts';
import { denoflareCliCommand } from './cli_common.ts';

export const TAIL_COMMAND = denoflareCliCommand('tail', 'View a stream of logs from a published worker')
    .arg('name', 'string', 'Name of the worker to tail')
    .option('format', 'enum', `Output format for log messages`, { value: 'json', default: true }, { value: 'pretty' }, { value: 'compact' })
    .option('header', 'strings', `Filter by HTTP header`, { hint: 'name:value' })
    .option('ipAddress', 'strings', `Filter by IP address ('self' to filter your own IP address)`)
    .option('method', 'strings', `Filter by HTTP method`)
    .option('samplingRate', 'string', `Adds a sampling rate (0.01 for 1%) (default: 1)`, { hint: 'rate' })
    .option('search', 'strings', 'Filter by a text match in console.log messages')
    .option('status', 'strings', 'Filter by invocation status (ok, error, canceled)')
    .option('once', 'boolean', `If set, stops the tail after receiving the first log (useful for testing)`)
    .include(commandOptionsForConfig)
    ;

export async function tail(args: (string | number)[], options: Record<string, unknown>) {
    if (TAIL_COMMAND.dumpHelp(args, options)) return;

    const opt = TAIL_COMMAND.parse(args, options);
    const { name: scriptName, verbose, once } = opt;

    const format = opt.format || 'json';
    if (verbose && format !== 'json') TailConnection.VERBOSE = true;

    const filters = computeFiltersFromOptions(opt);
    const config = await loadConfig(options);
    const { accountId, apiToken } = await resolveProfile(config, options);
    
    if (format !== 'json') console.log('creating tail...');
    const tail = await createTail(accountId, scriptName, apiToken);
    
    return new Promise((resolve, _reject) => {
        let sendHeartbeatOnExpiryTimeout = 0;

        const callbacks: TailConnectionCallbacks = {
            onOpen: (_cn, timeStamp) => {
                const timeStampStr = new Date(timeStamp).toISOString();
                if (format === 'compact') console.log(` open: ${timeStampStr}`);
                if (format === 'pretty') {
                    console.log(`Connected! Streaming logs from %c${scriptName}%c... (ctrl-c to quit)`, 'color: red', '');
                }
            },
            onClose: (_cn, timeStamp, code, reason, wasClean) => {
                const timeStampStr = new Date(timeStamp).toISOString();
                if (format === 'compact') console.log(`close: ${timeStampStr} ${JSON.stringify({ code, reason, wasClean })}`);
                clearTimeout(sendHeartbeatOnExpiryTimeout);
                resolve(undefined);
            },
            onError: (_cn, timeStamp, errorInfo) => {
                const timeStampStr = new Date(timeStamp).toISOString();
                if (format === 'compact') console.error(`error: ${timeStampStr}`, errorInfo);
                clearTimeout(sendHeartbeatOnExpiryTimeout);
                resolve(undefined);
            },
            onUnparsedMessage: (cn, _timeStamp, message, parseError) => {
                if (format === 'compact') {
                    console.log('Unparsed message', message);
                    console.error('Error parsing tail message', parseError);
                }
                cn.close();
                clearTimeout(sendHeartbeatOnExpiryTimeout);
                resolve(undefined);
            },
            onTailMessage: (cn, _timeStamp, message) => {
                if (format === 'compact') {
                    dumpMessageCompact(message);
                } else if (format === 'pretty') {
                    dumpMessagePretty(message, console.log);
                } else {
                    dumpMessageJson(message);
                }
                if (once) {
                    cn.close();
                    clearTimeout(sendHeartbeatOnExpiryTimeout);
                    resolve(undefined);
                }
            }
        };
        const _cn = new TailConnection(tail.url, callbacks, { websocketPingIntervalSeconds: 5 }).setOptions({ filters });

        let currentTail = tail;
        const sendHeartbeatOnExpiry = () => {
            const expiresInMillis = new Date(currentTail.expires_at).getTime() - Date.now();
            if (verbose) console.log(`Sending heartbeat in ${(expiresInMillis / 1000 / 60 / 60).toFixed(2)} hrs`);
            sendHeartbeatOnExpiryTimeout = setTimeout(async () => {
                if (verbose) console.log('Sending heartbeat...');
                const oldExpiry = currentTail.expires_at;
                currentTail = await sendTailHeartbeat(accountId, scriptName, currentTail.id, apiToken);
                const newExpiry = currentTail.expires_at;
                if (verbose) console.log(`Sent heartbeat${oldExpiry === newExpiry ? '' : `, expiry changed: ${oldExpiry} -> ${newExpiry}`}`)
                sendHeartbeatOnExpiry();
            }, expiresInMillis);
        }
        sendHeartbeatOnExpiry();
    });
}

//

type Format = 'json' | 'pretty' | 'compact';

function dumpMessageCompact(message: TailMessage) {
    const time = new Date(message.eventTimestamp).toISOString();
    if (isTailMessageCronEvent(message.event)) {
        const scheduledTime = new Date(message.event.scheduledTime).toISOString();
        console.log(` cron: ${time} ${message.event.cron} ${scheduledTime}`);
    } else {
        console.log(`  req: ${time} ${message.event.request.method} ${message.event.request.url}`);
        const userAgent = message.event.request.headers['user-agent'];
        if (userAgent) {
            console.log(`                                ${userAgent}`);
        }
        const response = message.event.response;
        if (response) {
            console.log(`                                ${response.status}`);
        }
    }
    for (const log of message.logs) {
        const timestamp = new Date(log.timestamp).toISOString();
        console.log(`      ${[timestamp, log.level, log.message.join(', ')].join(' ')}`);
    }
    for (const exception of message.exceptions) {
        const timestamp = new Date(exception.timestamp).toISOString();
        console.log(`      ${[timestamp, exception.name, exception.message].join(' ')}`);
    }
}

function dumpMessageJson(message: TailMessage) {
    console.log(JSON.stringify(message));
}

function computeFiltersFromOptions(opts: { search?: string[], status?: string[], header?: string[], sampleRate?: string, method?: string[], ipAddresses?: string[] }): readonly TailFilter[] {
    const rt: TailFilter[] = [];
    for (const search of opts.search ?? []) {
        rt.push({ query: search });
    }
    const outcomes = computeOutcomesForStatuses(opts.status ?? []);
    if (outcomes.length > 0) {
        rt.push({ outcome: outcomes });
    }
    const samplingRate = opts.sampleRate;
    if (typeof samplingRate === 'string') {
        rt.push({ sampling_rate: parseFloat(samplingRate) });
    }
    const methods = opts.method ?? [];
    if (methods.length > 0) {
        rt.push({ method: methods });
    }
    const ipAddresses = opts.ipAddresses ?? []
    if (ipAddresses.length > 0) {
        rt.push({ 'client_ip': ipAddresses });
    }
    const headers = opts.header ?? [];
    if (headers.length > 0) {
        for (const header of headers) {
            rt.push(parseHeaderFilter(header));
        }
    }
    return rt;
}

function computeOutcomesForStatuses(statuses: string[]): Outcome[] {
    const rt = new Set<Outcome>();
    for (const status of statuses) {
        for (const outcome of computeOutcomesForStatus(status)) {
            rt.add(outcome);
        }
    }
    return [...rt];
}

function computeOutcomesForStatus(status: string): Outcome[] {
    if (status === 'ok') return [ 'ok' ];
    if (status === 'error') return [ 'exception', 'exceededCpu', 'unknown' ];
    if (status === 'canceled') return [ 'canceled' ];
    throw new Error(`Invalid status: ${status}`);
}
