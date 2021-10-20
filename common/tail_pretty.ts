import { isTailMessageCronEvent, LogMessagePart, Outcome, TailMessage, TailMessageLog } from './tail.ts';

export interface AdditionalLog {
    // deno-lint-ignore no-explicit-any
    readonly data: any[];
}

// deno-lint-ignore no-explicit-any
export function dumpMessagePretty(message: TailMessage, logger: (...data: any[]) => void, additionalLogs: readonly AdditionalLog[] = []) {
    const time = formatLocalYyyyMmDdHhMmSs(new Date(message.eventTimestamp));
    const outcome = PRETTY_OUTCOMES.get(message.outcome) || message.outcome;
    const outcomeColor = message.outcome === 'ok' ? 'green' : 'red';
    const { props, remainingLogs } = parseLogProps(message.logs);
    if (isTailMessageCronEvent(message.event)) {
        const colo = props.colo || '???';
        logger(`[%c${time}%c] [%c${colo}%c] [%c${outcome}%c] %c${message.event.cron}`, 'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', 'color: red; font-style: bold;');
    } else {
        const { method, url, cf } = message.event.request;
        const colo = cf?.colo || props.colo || '???';
        if (cf === undefined) {
            // durable object request
            const { durableObjectClass, durableObjectName, durableObjectId } = computeDurableObjectInfo(props);
            const doTemplates: string[] = [];
            const doStyles: string[] = [];
            if (durableObjectClass) {
                doTemplates.push(`%c${durableObjectClass}%c`);
                doStyles.push(`color: gray; x-durable-object-class: '${durableObjectClass}'`, '');
            }
            if (durableObjectName) {
                doTemplates.push(`%c${durableObjectName}%c`);
                doStyles.push(`color: gray; x-durable-object-name: '${durableObjectName}'`, '');
            }
            if (durableObjectId) {
                doTemplates.push(`%c${computeShortDurableObjectId(durableObjectId)}%c`);
                doStyles.push(`color: gray; x-durable-object-id: '${durableObjectId}'`, '');
            }
            if (doTemplates.length === 0) {
                doTemplates.push(`%cDO%c`);
                doStyles.push('color: gray', '');
            }
            logger(`[%c${time}%c] [%c${colo}%c] [%c${outcome}%c] [${doTemplates.join(' ')}] ${method} %c${url}`, 
                'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', ...doStyles, 'color: red; font-style: bold;');
        } else {
            logger(`[%c${time}%c] [%c${colo}%c] [%c${outcome}%c] ${method} %c${url}`, 
                'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', 'color: red; font-style: bold;');
        }
    }
    for (const { data } of additionalLogs) {
        logger(...data);
    }
    for (const { level, message: logMessage } of remainingLogs) {
        const levelColor = LOG_LEVEL_COLORS.get(level) || 'gray';
        const logMessages = logMessage.map(formatLogMessagePart).join(', ');
        logger(` %c|%c [%c${level}%c] ${logMessages}`, 'color: gray', '', `color: ${levelColor}`, '');
    }
    for (const { name, message: exceptionMessage } of message.exceptions) {
        logger(` %c|%c [%c${name}%c] %c${exceptionMessage}`, 'color: gray', '', `color: red; font-style: bold`, '', 'color: red');
    }
}

export function formatLocalYyyyMmDdHhMmSs(date: Date): string {
    return [date.getFullYear(), '-', pad2(date.getMonth() + 1), '-', pad2(date.getDate()), ' ', pad2(date.getHours()), ':', pad2(date.getMinutes()), ':', pad2(date.getSeconds())].join('');
}

export function parseLogProps(logs: readonly TailMessageLog[]): { props: Record<string, unknown>, remainingLogs: readonly TailMessageLog[] } {
    const remainingLogs: TailMessageLog[] = [];
    const props: Record<string, unknown> = {};
    for (const log of logs) {
        if (log.message.length > 0) {
            const msg = log.message[0];
            if (typeof msg === 'string' && msg.startsWith('logprops:')) {
                const trailer = msg.substring(msg.indexOf(':') + 1);
                const trailerProps = tryParsePropsFromJson(trailer);
                appendProps(trailerProps, props);
                for (const part of log.message.slice(1)) {
                    const partProps = tryParsePropsFromPart(part);
                    appendProps(partProps, props);
                }
                continue;
            }
        }
        remainingLogs.push(log);
    }
    return { props, remainingLogs };
}

//

interface DurableObjectInfo {
    readonly durableObjectClass?: string;
    readonly durableObjectId?: string;
    readonly durableObjectName?: string;
}

//

function computeDurableObjectInfo(props: Record<string, unknown>): DurableObjectInfo {
    const durableObjectClass = undefinedIfEmpty((typeof props.durableObjectClass === 'string' ? props.durableObjectClass : '').trim());
    const durableObjectId = undefinedIfEmpty((typeof props.durableObjectId === 'string' ? props.durableObjectId : '').trim());
    const durableObjectName = undefinedIfEmpty((typeof props.durableObjectName === 'string' ? props.durableObjectName : '').trim());
    return { durableObjectClass, durableObjectId, durableObjectName };
}

function undefinedIfEmpty(str: string): string | undefined {
    return str === '' ? undefined : str;
}

function computeShortDurableObjectId(id: string): string {
    return /^[0-9a-fA-F]{5,}$/.test(id) ? `${id.substring(0, 4)}…` : id;
}

function appendProps(src: Record<string, unknown> | undefined, dst: Record<string, unknown>) {
    if (src) {
        for (const [ key, value] of Object.entries(src)) {
            dst[key] = value;
        }
    }
}

function tryParsePropsFromJson(value: string): Record<string, unknown> | undefined {
    try {
        const props = JSON.parse(value.trim());
        if (typeof props === 'object' && props !== null && !Array.isArray(props)) {
            return props as Record<string, unknown>;
        }
    } catch { 
        // noop
    }
    return undefined;
}


function tryParsePropsFromPart(part: LogMessagePart): Record<string, unknown> | undefined {
    try {
        if (typeof part === 'object' && part !== null && !Array.isArray(part)) {
            return part as Record<string, unknown>;
        }
    } catch { 
        // noop
    }
    return undefined;
}

function formatLogMessagePart(part: LogMessagePart): string {
    if (typeof part === 'object') return JSON.stringify(part);
    return `${part}`;
}

function pad2(num: number): string {
    return num.toString().padStart(2, '0');
}

const PRETTY_OUTCOMES = new Map<Outcome, string>([
    ['ok', 'Ok'],
    ['exception', 'Error'],
    ['exceededCpu', 'Exceeded Limit'],
    ['canceled', 'Canceled'],
    ['unknown', 'Unknown'],
]);

const LOG_LEVEL_COLORS = new Map<string, string>([
    ['trace', 'gray'],
    ['debug', 'purple'],
    ['log', 'gray'],
    ['info', 'gray'],
    ['warn', 'red'],
    ['error', 'red'],
]);
