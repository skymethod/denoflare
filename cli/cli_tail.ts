import { createTail, sendTailHeartbeat } from '../common/cloudflare_api.ts';
import { loadConfig, resolveProfile } from './config_loader.ts';
import { isTailMessageCronEvent, Outcome, parseHeaderFilter, TailFilter, TailMessage } from '../common/tail.ts';
import { TailConnection, TailConnectionCallbacks } from '../common/tail_connection.ts';
import { dumpMessagePretty } from '../common/tail_pretty.ts';
import { CLI_VERSION } from './cli_version.ts';

export async function tail(args: (string | number)[], options: Record<string, unknown>) {
    const scriptName = args[0];
    if (options.help || typeof scriptName !== 'string') {
        dumpHelp();
        return;
    }
    const format = computeFormat(options);
    const verbose = !!options.verbose;
    if (verbose && format !== 'json') TailConnection.VERBOSE = true;
    const filters = computeFiltersFromOptions(options);
    const once = !!options.once;
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

const FORMATS = new Set(['json', 'pretty', 'compact']);
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

function computeFiltersFromOptions(options: Record<string, unknown>): readonly TailFilter[] {
    const rt: TailFilter[] = [];
    for (const search of optionStrings('search', options)) {
        rt.push({ query: search });
    }
    const outcomes = computeOutcomesForStatuses(optionStrings('status', options));
    if (outcomes.length > 0) {
        rt.push({ outcome: outcomes });
    }
    const samplingRate = options['sampling-rate'];
    if (typeof samplingRate === 'number') {
        rt.push({ sampling_rate: samplingRate });
    }
    const methods = optionStrings('method', options);
    if (methods.length > 0) {
        rt.push({ method: methods });
    }
    const ipAddresses = optionStrings('ip-address', options);
    if (ipAddresses.length > 0) {
        rt.push({ 'client_ip': ipAddresses });
    }
    const headers = optionStrings('header', options);
    if (headers.length > 0) {
        for (const header of headers) {
            rt.push(parseHeaderFilter(header));
        }
    }
    return rt;
}

function computeFormat(options: Record<string, unknown>): Format {
    const format = options.format || options.f;
    if (format === undefined) return 'json';
    if (typeof format === 'string' && FORMATS.has(format)) return format as Format;
    throw new Error(`Invalid format: ${format}`);
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

function optionStrings(name: string, options: Record<string, unknown>): string[] {
    const val = options[name];
    if (typeof val === 'string') return [ val ];
    if (Array.isArray(val)) {
        return val.filter(v => typeof v === 'string');
    }
    return [];
}

function dumpHelp() {
    const lines = [
        `denoflare-tail ${CLI_VERSION}`,
        'View a stream of logs from a published worker',
        '',
        'USAGE:',
        '    denoflare tail [FLAGS] [OPTIONS] [--] [name]',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --once        Stops the tail after receiving the first log (useful for testing)',
        '        --verbose     Toggle verbose output (when applicable)',
        '',
        'OPTIONS:',
        '    -f, --format <format>                   Output format for log messages [default: json]  [possible values: json, pretty]',
        '        --header <header>...                Filter by HTTP header',
        '        --ip-address <ip-address>...        Filter by IP address ("self" to filter your own IP address)',
        '        --method <method>...                Filter by HTTP method',
        '        --sampling-rate <sampling-rate>     Adds a sampling rate (0.01 for 1%) [default: 1]',
        '        --search <search>                   Filter by a text match in console.log messages',
        '        --status <status>...                Filter by invocation status [possible values: ok, error, canceled]',
        '        --profile <name>                    Name of profile to load from config (default: only profile or default profile in config)',
        '        --config <path>                     Path to config file (default: .denoflare in cwd or parents)',
        '',
        'ARGS:',
        '    <name>    Name of the worker to tail',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
