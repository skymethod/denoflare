import { isStringRecord } from './check.ts';
import { IncomingRequestCfProperties } from './cloudflare_workers_types.d.ts';
import { setEqual, setSubtract, setUnion } from './sets.ts';

// Types For Found Tail Websocket Message Payloads

export interface TailOptions {
    readonly filters: readonly TailFilter[];
}

export type TailFilter = ClientIpFilter | QueryFilter | HeaderFilter | MethodFilter | SampleRateFilter | OutcomeFilter;

export interface ClientIpFilter {
    readonly 'client_ip': string[]; // ip address or "self" (which doesn't seem to work)
}

export interface QueryFilter {
    readonly query: string; // text match on console.log messages
}

export interface HeaderFilter {
    readonly key: string;
    readonly query?: string;
}

export function parseHeaderFilter(header: string): HeaderFilter {
    const i = header.indexOf(':');
    if (i < 0) return { key: header };
    const key = header.substring(0, i).trim();
    const query = header.substring(i + 1).trim();
    return { key, query };
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
    readonly scriptName: string | null; // found string script name (of the current script) when called from pubsub
    readonly exceptions: readonly TailMessageException[];
    readonly logs: readonly TailMessageLog[];
    readonly eventTimestamp: number; // epoch millis (null for DO alarm callbacks, filled in client-side)
    readonly event: TailMessageEvent | null; // null for DO alarm callbacks
    readonly diagnosticsChannelEvents?: unknown[];
    readonly truncated?: boolean;
}

export type TailMessageEvent = TailMessageCronEvent | TailMessageRequestEvent | TailMessageQueueEvent | TailMessageAlarmEvent | TailMessageEmailEvent | TailMessageOverloadEvent | TailMessageGetWebSocketEvent;

const REQUIRED_TAIL_MESSAGE_KEYS = new Set(['outcome', 'scriptName', 'exceptions', 'logs', 'eventTimestamp', 'event']);
const ALL_TAIL_MESSAGE_KEYS = new Set([ ...REQUIRED_TAIL_MESSAGE_KEYS, 'diagnosticsChannelEvents', 'scriptVersion', 'truncated' ]);

const KNOWN_OUTCOMES = new Set(['ok', 'exception', 'exceededCpu', 'canceled', 'unknown']);

export function parseTailMessage(obj: unknown): TailMessage {
   
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessage: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_KEYS, ALL_TAIL_MESSAGE_KEYS);
    // deno-lint-ignore no-explicit-any
    const objAsAny = obj as any;
    const { outcome, scriptName, scriptVersion, eventTimestamp, diagnosticsChannelEvents, truncated } = objAsAny;
    if (diagnosticsChannelEvents !== undefined && !Array.isArray(diagnosticsChannelEvents)) throw new Error(JSON.stringify(diagnosticsChannelEvents));
    if (scriptVersion !== undefined && !(isStringRecord(scriptVersion) && typeof scriptVersion.id === 'string')) throw new Error(`Unexpected scriptVersion: ${JSON.stringify(scriptVersion)}`); // scriptVersion: { id: "a5802a95-358d-4b4c-b570-44c57314fd01" },
    if (!KNOWN_OUTCOMES.has(outcome)) throw new Error(`Bad outcome: expected one of [${[...KNOWN_OUTCOMES].join(', ')}], found ${JSON.stringify(outcome)}`);
    if (scriptName !== null && typeof scriptName !== 'string') throw new Error(`Bad scriptName: expected string or null, found ${JSON.stringify(scriptName)}`);
    if (!(truncated === undefined || typeof truncated === 'boolean')) throw new Error(`Bad truncated: expected boolean, found ${JSON.stringify(truncated)}`);
    const logs = parseLogs(objAsAny.logs);
    const exceptions = parseExceptions(objAsAny.exceptions);
    if (eventTimestamp === null && objAsAny.event === null) {
        // DO alarm
        return { outcome, scriptName, exceptions, logs, eventTimestamp: Date.now(), event: null };
    }
    if (!(typeof eventTimestamp === 'number' && eventTimestamp > 0)) throw new Error(`Bad eventTimestamp: expected positive number, found ${JSON.stringify(eventTimestamp)}`);
    const event = objAsAny.event && objAsAny.event.request ? parseTailMessageRequestEvent(objAsAny.event)
        : objAsAny.event && objAsAny.event.queue ? parseTailMessageQueueEvent(objAsAny.event)
        : objAsAny.event && objAsAny.event.cron ? parseTailMessageCronEvent(objAsAny.event)
        : objAsAny.event && objAsAny.event.mailFrom ? parseTailMessageEmailEvent(objAsAny.event)
        : objAsAny.event && objAsAny.event.type === 'overload' ? parseTailMessageOverloadEvent(objAsAny.event)
        : objAsAny.event && objAsAny.event.getWebSocketEvent ? parseTailMessageGetWebSocketEvent(objAsAny.event)
        : parseTailMessageAlarmEvent(objAsAny.event);

    return { outcome, scriptName, exceptions, logs, eventTimestamp, event, diagnosticsChannelEvents, truncated };
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
    readonly message: readonly LogMessagePart[];
    readonly level: string; // e.g. log
    readonly timestamp: number; // epoch millis
}

export type LogMessagePart = string | number | boolean | undefined | object;

function isLogMessagePart(value: unknown): value is LogMessagePart {
    const t = typeof value;
    return t === 'string' || t === 'number' || t === 'boolean' || t === 'undefined' || t === 'object';
}

const REQUIRED_TAIL_MESSAGE_LOG_KEYS = new Set(['message', 'level', 'timestamp']);

function parseTailMessageLog(obj: unknown): TailMessageLog {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageLog: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_LOG_KEYS);
    // deno-lint-ignore no-explicit-any
    const objAsAny = obj as any;
    const message = parseLogMessagePartArray(objAsAny.message, 'message');
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
    readonly stack?: string;
}

const REQUIRED_TAIL_MESSAGE_EXCEPTION_KEYS = new Set(['name', 'message', 'timestamp']);
const ALL_TAIL_MESSAGE_EXCEPTION_KEYS = setUnion(REQUIRED_TAIL_MESSAGE_EXCEPTION_KEYS, new Set([ 'stack' ]));

function parseTailMessageException(obj: unknown): TailMessageException {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageException: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_EXCEPTION_KEYS, ALL_TAIL_MESSAGE_EXCEPTION_KEYS);
    // deno-lint-ignore no-explicit-any
    const objAsAny = obj as any;
    const { name, message, timestamp, stack } = objAsAny;
    if (!(typeof name === 'string')) throw new Error(`Bad name: expected string, found ${JSON.stringify(name)}`);
    if (!(typeof message === 'string')) throw new Error(`Bad message: expected string, found ${JSON.stringify(message)}`);
    if (!(typeof timestamp === 'number' && timestamp > 0)) throw new Error(`Bad timestamp: expected positive number, found ${JSON.stringify(timestamp)}`);
    if (!(stack === undefined || typeof stack === 'string')) throw new Error(`Bad stack: expected string, found ${JSON.stringify(stack)}`);
    return { name, message, timestamp, stack };
}

//

export interface TailMessageQueueEvent {
    readonly batchSize: number; // e.g. 1
    readonly queue: string; // queue name
}

const REQUIRED_TAIL_MESSAGE_QUEUE_EVENT_KEYS = new Set(['batchSize', 'queue']);

export function isTailMessageQueueEvent(obj: unknown): obj is TailMessageQueueEvent {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
    const keys = new Set(Object.keys(obj));
    return setEqual(keys, REQUIRED_TAIL_MESSAGE_QUEUE_EVENT_KEYS);
}

function parseTailMessageQueueEvent(obj: unknown): TailMessageQueueEvent {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageQueueEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_QUEUE_EVENT_KEYS);
    // deno-lint-ignore no-explicit-any
    const objAsAny = obj as any;
    const { batchSize, queue } = objAsAny;
    if (!(typeof batchSize === 'number' && batchSize > 0)) throw new Error(`Bad batchSize: expected positive number, found ${JSON.stringify(batchSize)}`);
    if (!(typeof queue === 'string')) throw new Error(`Bad queue: expected string, found ${JSON.stringify(queue)}`);
    return { batchSize, queue };
}

//

export interface TailMessageAlarmEvent {
    readonly scheduledTime: string; // instant
}

const REQUIRED_TAIL_MESSAGE_ALARM_EVENT_KEYS = new Set(['scheduledTime']);

export function isTailMessageAlarmEvent(obj: unknown): obj is TailMessageAlarmEvent {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
    const keys = new Set(Object.keys(obj));
    return setEqual(keys, REQUIRED_TAIL_MESSAGE_ALARM_EVENT_KEYS);
}

function parseTailMessageAlarmEvent(obj: unknown): TailMessageAlarmEvent {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageAlarmEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_ALARM_EVENT_KEYS);
    // deno-lint-ignore no-explicit-any
    const objAsAny = obj as any;
    const { scheduledTime } = objAsAny;
    if (!(typeof scheduledTime === 'string')) throw new Error(`Bad scheduledTime: expected string, found ${JSON.stringify(scheduledTime)}`);
    return { scheduledTime };
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

export interface TailMessageEmailEvent {
    readonly rawSize: number; // e.g. 5985
    readonly rcptTo: string; // e.g. receiver@yourcfdomain.com
    readonly mailFrom: string; // e.g. sender@example.com
}

const REQUIRED_TAIL_MESSAGE_EMAIL_EVENT_KEYS = new Set(['rawSize', 'rcptTo', 'mailFrom']);

export function isTailMessageEmailEvent(obj: unknown): obj is TailMessageEmailEvent {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
    const keys = new Set(Object.keys(obj));
    return setEqual(keys, REQUIRED_TAIL_MESSAGE_EMAIL_EVENT_KEYS);
}

function parseTailMessageEmailEvent(obj: unknown): TailMessageEmailEvent {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageEmailEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_EMAIL_EVENT_KEYS);
    // deno-lint-ignore no-explicit-any
    const objAsAny = obj as any;
    const { rawSize, rcptTo, mailFrom } = objAsAny;
    if (!(typeof rawSize === 'number' && rawSize > 0)) throw new Error(`Bad rawSize: expected positive number, found ${JSON.stringify(rawSize)}`);
    if (!(typeof rcptTo === 'string')) throw new Error(`Bad rcptTo: expected string, found ${JSON.stringify(rcptTo)}`);
    if (!(typeof mailFrom === 'string')) throw new Error(`Bad mailFrom: expected string, found ${JSON.stringify(mailFrom)}`);
    return { rawSize, rcptTo, mailFrom };
}

export interface TailMessageOverloadEvent {
    readonly type: string; // "overload"
    readonly message: string; // e.g. Tail is currently in sampling mode due to the high volume of messages. To prevent messages from ...
}

const REQUIRED_TAIL_MESSAGE_OVERLOAD_EVENT_KEYS = new Set(['type', 'message']);

export function isTailMessageOverloadEvent(obj: unknown): obj is TailMessageOverloadEvent {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
    const keys = new Set(Object.keys(obj));
    // deno-lint-ignore no-explicit-any
    return setEqual(keys, REQUIRED_TAIL_MESSAGE_OVERLOAD_EVENT_KEYS) && (obj as any).type === 'overload';
}

function parseTailMessageOverloadEvent(obj: unknown): TailMessageOverloadEvent {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageOverloadEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_OVERLOAD_EVENT_KEYS);
    // deno-lint-ignore no-explicit-any
    const objAsAny = obj as any;
    const { type, message } = objAsAny;
    if (!(type === 'overload')) throw new Error(`Bad type: expected "overload", found ${JSON.stringify(type)}`);
    if (!(typeof message === 'string')) throw new Error(`Bad message: expected string, found ${JSON.stringify(message)}`);
    return { type, message };
}

export interface TailMessageGetWebSocketEvent {
    readonly getWebSocketEvent: Record<string, unknown>; // e.g. { wasClean: false, code: 1006, webSocketEventType: "close" }, {"webSocketEventType":"message"}
}

const REQUIRED_TAIL_MESSAGE_GET_WEB_SOCKET_EVENT_KEYS = new Set(['getWebSocketEvent']);

export function isTailMessageGetWebSocketEvent(obj: unknown): obj is TailMessageGetWebSocketEvent {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
    const keys = new Set(Object.keys(obj));
    return setEqual(keys, REQUIRED_TAIL_MESSAGE_GET_WEB_SOCKET_EVENT_KEYS);
}

function parseTailMessageGetWebSocketEvent(obj: unknown): TailMessageGetWebSocketEvent {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageGetWebSocketEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_GET_WEB_SOCKET_EVENT_KEYS);
    // deno-lint-ignore no-explicit-any
    const objAsAny = obj as any;
    const { getWebSocketEvent } = objAsAny;
    if (!(isStringRecord(getWebSocketEvent))) throw new Error(`Bad type: expected record, found ${JSON.stringify(getWebSocketEvent)}`);
    return { getWebSocketEvent };
}

//

export interface TailMessageRequestEvent {
    readonly request: TailMessageEventRequest;
    readonly response?: TailMessageEventResponse;
}

const REQUIRED_TAIL_MESSAGE_REQUEST_EVENT_KEYS = new Set(['request']);
const OPTIONAL_TAIL_MESSAGE_REQUEST_EVENT_KEYS = new Set(['response']);
const ALL_TAIL_MESSAGE_REQUEST_EVENT_KEYS = setUnion(REQUIRED_TAIL_MESSAGE_REQUEST_EVENT_KEYS, OPTIONAL_TAIL_MESSAGE_REQUEST_EVENT_KEYS);


function parseTailMessageRequestEvent(obj: unknown): TailMessageRequestEvent {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageRequestEvent: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_REQUEST_EVENT_KEYS, ALL_TAIL_MESSAGE_REQUEST_EVENT_KEYS);
    // deno-lint-ignore no-explicit-any
    const objAsAny = obj as any;
    const request = parseTailMessageEventRequest(objAsAny.request);
    const response = parseTailMessageEventResponse(objAsAny.response);
    return { request, response };
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

export interface TailMessageEventResponse {
    readonly status: number;
}

const REQUIRED_TAIL_MESSAGE_EVENT_RESPONSE_KEYS = new Set(['status']);

function parseTailMessageEventResponse(obj: unknown): TailMessageEventResponse | undefined {
    if (obj === undefined) return undefined;
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad tailMessageEventResponse: Expected object, found ${JSON.stringify(obj)}`);
    checkKeys(obj, REQUIRED_TAIL_MESSAGE_EVENT_RESPONSE_KEYS);
    // deno-lint-ignore no-explicit-any
    const objAsAny = obj as any;
    const { status } = objAsAny;
    if (!(typeof status === 'number')) throw new Error(`Bad status: expected number, found ${JSON.stringify(status)}`);
    return { status };
}

//

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

function parseLogMessagePartArray(obj: unknown, name: string): readonly LogMessagePart[]  {
    if (typeof obj !== 'object' || !Array.isArray(obj)) throw new Error(`Bad ${name}: Expected log message part array, found ${JSON.stringify(obj)}`);
    for (const value of obj) {
        if (!isLogMessagePart(value)) throw new Error(`Bad ${name}: Expected log message part array, found ${JSON.stringify(obj)}`);
    }
    return obj as readonly LogMessagePart[];
}

function parseIncomingRequestCfProperties(obj: unknown): IncomingRequestCfProperties {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new Error(`Bad cf: Expected object, found ${JSON.stringify(obj)}`);
    // good enough
    return obj as IncomingRequestCfProperties;
}
