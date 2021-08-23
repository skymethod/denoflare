import { isTailMessageCronEvent, Outcome, TailMessage } from './tail.ts';

// deno-lint-ignore no-explicit-any
export function dumpMessagePretty(message: TailMessage, logger: (...data: any[]) => void) {
    const time = formatLocalYyyyMmDdHhMmSs(new Date(message.eventTimestamp));
    const outcome = PRETTY_OUTCOMES.get(message.outcome) || message.outcome;
    const outcomeColor = message.outcome === 'ok' ? 'green' : 'red';
    if (isTailMessageCronEvent(message.event)) {
        logger(`[%c${time}%c] [%c$???%c] [%c${outcome}%c] %c${message.event.cron}`, 'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', 'color: red; font-style: bold;');
    } else {
        const { method, url, cf } = message.event.request;
        const colo = cf?.colo || '???';
        logger(`[%c${time}%c] [%c${colo}%c] [%c${outcome}%c] ${method} %c${url}`, 'color: gray', '', 'color: gray', '', `color: ${outcomeColor}`, '', 'color: red; font-style: bold;');
    }
    for (const { level, message: logMessage } of message.logs) {
        const levelColor = LOG_LEVEL_COLORS.get(level) || 'gray';
        logger(` %c|%c [%c${level}%c] ${logMessage}`, 'color: gray', '', `color: ${levelColor}`, '');
    }
    for (const { name, message: exceptionMessage } of message.exceptions) {
        logger(` %c|%c [%c${name}%c] %c${exceptionMessage}`, 'color: gray', '', `color: red; font-style: bold`, '', 'color: red');
    }
}

//

function pad2(num: number): string {
    return num.toString().padStart(2, '0');
}

function formatLocalYyyyMmDdHhMmSs(date: Date): string {
    return [date.getFullYear(), '-', pad2(date.getMonth() + 1), '-', pad2(date.getDate()), ' ', pad2(date.getHours()), ':', pad2(date.getMinutes()), ':', pad2(date.getSeconds())].join('');
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
