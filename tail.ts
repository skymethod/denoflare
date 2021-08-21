import { IncomingRequestCfProperties } from './deps_cf.ts';

// Types For Found Tail Websocket Message Payloads

export interface TailOptions {
    readonly filters: readonly TailFilter[];
}

export type TailFilter = ClientIpFilter | QueryFilter | HeaderFilter | MethodFilter | SampleRateFilter | OutcomeFilter;

export interface ClientIpFilter {
    readonly 'client_ip': string; // ip address or "self" (which doesn't seem to work)
}

export interface QueryFilter {
    readonly query: string; // text match on console.log messages
}

export interface HeaderFilter {
    readonly key: string;
    readonly value?: string;
}

export interface MethodFilter {
    readonly method: readonly string[]; // GET, POST, etc
}

export interface SampleRateFilter {
    readonly 'sampling_rate': number; // e.g. 0.01 for 1%
}

export interface OutcomeFilter {
    readonly outcome: readonly Outcome[];
}

export type Outcome = 'ok' | 'exception' | 'exceededCpu' | 'canceled' | 'unknown';

export interface TailMessage {
    readonly outcome: Outcome;
    readonly scriptName: null;
    readonly exceptions: readonly TailMessageException[];
    readonly logs: readonly TailMessageLog[];
    readonly eventTimestamp: number; // epoch millis
    readonly event: TailMessageEvent;
}

export type TailMessageEvent = TailMessageCronEvent | TailMessageRequestEvent;

const REQUIRED_TAIL_MESSAGE_KEYS = new Set(['outcome', 'scriptName', 'exceptions', 'logs', 'eventTimestamp', 'event']);

const KNOWN_OUTCOMES = new Set(['ok', 'exception', 'exceededCpu', 'canceled', 'unknown']);

export function parseTailMessage(obj: unknown): TailMessage {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessage: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_KEYS);
    // deno-lint-ignore no-explicit-any
    const objAsAny = obj as any;
    const { outcome, scriptName, eventTimestamp } = objAsAny;
    if (!KNOWN_OUTCOMES.has(outcome)) throw new Error(`Bad outcome: expected one of [${[...KNOWN_OUTCOMES].join(', ')}], found ${JSON.stringify(outcome)}`);
    if (scriptName !== null) throw new Error(`Bad scriptName: expected null, found ${JSON.stringify(scriptName)}`);
    const logs = parseLogs(objAsAny.logs);
    const exceptions = parseExceptions(objAsAny.exceptions);
    if (!(typeof eventTimestamp === 'number' && eventTimestamp > 0)) throw new Error(`Bad eventTimestamp: expected positive number, found ${JSON.stringify(eventTimestamp)}`);
    const event = objAsAny.event && objAsAny.event.request ? parseTailMessageRequestEvent(objAsAny.event) : parseTailMessageCronEvent(objAsAny.event);
    return { outcome, scriptName, exceptions, logs, eventTimestamp, event };
}

function parseLogs(obj: unknown): readonly TailMessageLog[] {
    if (!(Array.isArray(obj))) throw new Error(`Bad logs: expected array, found ${JSON.stringify(obj)}`);
    return [...obj].map(parseTailMessageLog);
}

function parseExceptions(obj: unknown): readonly TailMessageException[] {
    if (!(Array.isArray(obj))) throw new Error(`Bad exceptions: expected array, found ${JSON.stringify(obj)}`);
    return [...obj].map(parseTailMessageException);
}

//

export interface TailMessageLog {
    readonly message: readonly string[];
    readonly level: string; // e.g. log
    readonly timestamp: number; // epoch millis
}

const REQUIRED_TAIL_MESSAGE_LOG_KEYS = new Set(['message', 'level', 'timestamp']);

function parseTailMessageLog(obj: unknown): TailMessageLog {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageLog: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_LOG_KEYS);
    // deno-lint-ignore no-explicit-any
    const objAsAny = obj as any;
    const message = parseStringArray(objAsAny.message, 'message');
    const { level, timestamp } = objAsAny;
    if (!(typeof level === 'string')) throw new Error(`Bad level: expected string, found ${JSON.stringify(level)}`);
    if (!(typeof timestamp === 'number' && timestamp > 0)) throw new Error(`Bad timestamp: expected positive number, found ${JSON.stringify(timestamp)}`);

    return { message, level, timestamp };
}

//

export interface TailMessageException {
    readonly name: string; // e.g. Error
    readonly message: string; // Error.message
    readonly timestamp: number; // epoch millis
}

const REQUIRED_TAIL_MESSAGE_EXCEPTION_KEYS = new Set(['name', 'message', 'timestamp']);

function parseTailMessageException(obj: unknown): TailMessageException {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageException: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_EXCEPTION_KEYS);
    // deno-lint-ignore no-explicit-any
    const objAsAny = obj as any;
    const { name, message, timestamp } = objAsAny;
    if (!(typeof name === 'string')) throw new Error(`Bad name: expected string, found ${JSON.stringify(name)}`);
    if (!(typeof message === 'string')) throw new Error(`Bad message: expected string, found ${JSON.stringify(message)}`);
    if (!(typeof timestamp === 'number' && timestamp > 0)) throw new Error(`Bad timestamp: expected positive number, found ${JSON.stringify(timestamp)}`);

    return { name, message, timestamp };
}

//

export interface TailMessageCronEvent {
    readonly cron: string; // e.g. "*/1 * * * *"
    readonly scheduledTime: number; // epoch millis
}

const REQUIRED_TAIL_MESSAGE_CRON_EVENT_KEYS = new Set(['cron', 'scheduledTime']);

export function isTailMessageCronEvent(obj: unknown): obj is TailMessageCronEvent {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
    const keys = new Set(Object.keys(obj));
    return setEqual(keys, REQUIRED_TAIL_MESSAGE_CRON_EVENT_KEYS);
}

function parseTailMessageCronEvent(obj: unknown): TailMessageCronEvent {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageCronEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_CRON_EVENT_KEYS);
    // deno-lint-ignore no-explicit-any
    const objAsAny = obj as any;
    const { cron, scheduledTime } = objAsAny;
    if (!(typeof cron === 'string')) throw new Error(`Bad cron: expected string, found ${JSON.stringify(cron)}`);
    if (!(typeof scheduledTime === 'number' && scheduledTime > 0)) throw new Error(`Bad scheduledTime: expected positive number, found ${JSON.stringify(scheduledTime)}`);
    return { cron, scheduledTime };
}

//

export interface TailMessageRequestEvent {
    readonly request: TailMessageEventRequest;
}

const REQUIRED_TAIL_MESSAGE_REQUEST_EVENT_KEYS = new Set(['request']);

function parseTailMessageRequestEvent(obj: unknown): TailMessageRequestEvent {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageRequestEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_REQUEST_EVENT_KEYS);
    // deno-lint-ignore no-explicit-any
    const objAsAny = obj as any;
    const request = parseTailMessageEventRequest(objAsAny.request);
    return { request };
}

//

export interface TailMessageEventRequest {
    readonly url: string;
    readonly method: string;
    readonly headers: Record<string, string>;
    readonly cf?: IncomingRequestCfProperties; // undefined for DO requests
}

const REQUIRED_TAIL_MESSAGE_EVENT_REQUEST_KEYS = new Set(['url', 'method', 'headers']);
const OPTIONAL_TAIL_MESSAGE_EVENT_REQUEST_KEYS = new Set(['cf']);
const ALL_TAIL_MESSAGE_EVENT_REQUEST_KEYS = setUnion(REQUIRED_TAIL_MESSAGE_EVENT_REQUEST_KEYS, OPTIONAL_TAIL_MESSAGE_EVENT_REQUEST_KEYS);

function parseTailMessageEventRequest(obj: unknown): TailMessageEventRequest {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageEventRequest: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_EVENT_REQUEST_KEYS, ALL_TAIL_MESSAGE_EVENT_REQUEST_KEYS);
    // deno-lint-ignore no-explicit-any
    const objAsAny = obj as any;
    const { url, method } = objAsAny;
    if (!(typeof url === 'string')) throw new Error(`Bad url: expected string, found ${JSON.stringify(url)}`);
    if (!(typeof method === 'string')) throw new Error(`Bad method: expected string, found ${JSON.stringify(method)}`);
    const headers = parseStringRecord(objAsAny.headers, 'headers');
    const cf = objAsAny.cf === undefined ? undefined : parseIncomingRequestCfProperties(objAsAny.cf);
    return { url, method, headers, cf };
}

//

// deno-lint-ignore ban-types
function checkKeys(obj: object, requiredKeys: Set<string>, allKeys?: Set<string>) {
    const keys = new Set(Object.keys(obj));
    const missingKeys = setSubtract(requiredKeys, keys);
    if (missingKeys.size > 0) throw new Error(`Missing keys: ${[...missingKeys].join(', ')}`);
    const extraKeys = setSubtract(keys, allKeys || requiredKeys);
    if (extraKeys.size > 0) throw new Error(`Extra keys: ${[...extraKeys].join(', ')}`);
}

function parseStringRecord(obj: unknown, name: string): Record<string, string> {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad ${name}: Expected string record, found ${JSON.stringify(obj)}`);
    for (const [_, value] of Object.entries(obj)) {
        if (typeof value !== 'string') throw new Error(`Bad ${name}: Expected string record, found ${JSON.stringify(obj)}`);
    }
    return obj as Record<string, string>;
}

function parseStringArray(obj: unknown, name: string): readonly string[] {
    if (typeof obj !== 'object' || !Array.isArray(obj)) throw new Error(`Bad ${name}: Expected string array, found ${JSON.stringify(obj)}`);
    for (const value of obj) {
        if (typeof value !== 'string') throw new Error(`Bad ${name}: Expected string array, found ${JSON.stringify(obj)}`);
    }
    return obj as readonly string[];
}

function parseIncomingRequestCfProperties(obj: unknown): IncomingRequestCfProperties {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad cf: Expected object, found ${JSON.stringify(obj)}`);
    // good enough
    return obj as IncomingRequestCfProperties;
}

function setSubtract<T>(lhs: Set<T>, rhs: Set<T>): Set<T> {
    const rt = new Set(lhs);
    for (const item of rhs) {
        rt.delete(item);
    }
    return rt;
}

function setUnion<T>(lhs: Set<T>, rhs: Set<T>): Set<T> {
    const rt = new Set(lhs);
    for (const item of rhs) {
        rt.add(item);
    }
    return rt;
}

function setEqual<T>(lhs: Set<T>, rhs: Set<T>): boolean {
    return lhs.size === rhs.size && [...lhs].every(v => rhs.has(v));
}
