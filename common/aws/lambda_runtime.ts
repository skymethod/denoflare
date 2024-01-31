import type { LambdaHttpRequest, LambdaWorkerContext, LambdaWorkerInfo } from './lambda_runtime.d.ts';

const startTime = Date.now();
const envObj = Deno.env.toObject();
const denoRunTime = envObj['DENO_RUN_TIME'];
const bootstrapTime = denoRunTime === undefined ? 0 : Math.round(parseFloat(denoRunTime) / 1000000);

const AWS_LAMBDA_RUNTIME_API = Deno.env.get('AWS_LAMBDA_RUNTIME_API');

// inlined from https://deno.land/std@0.213.0/encoding/base64.ts

const base64abc = [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'g',
    'h',
    'i',
    'j',
    'k',
    'l',
    'm',
    'n',
    'o',
    'p',
    'q',
    'r',
    's',
    't',
    'u',
    'v',
    'w',
    'x',
    'y',
    'z',
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '+',
    '/',
];

function encodeBase64(data: ArrayBuffer | string): string {
    const uint8 = typeof data === 'string'
        ? new TextEncoder().encode(data)
        : data instanceof Uint8Array
            ? data
            : new Uint8Array(data);
    let result = '',
        i;
    const l = uint8.length;
    for (i = 2; i < l; i += 3) {
        result += base64abc[uint8[i - 2] >> 2];
        result += base64abc[((uint8[i - 2] & 0x03) << 4) | (uint8[i - 1] >> 4)];
        result += base64abc[((uint8[i - 1] & 0x0f) << 2) | (uint8[i] >> 6)];
        result += base64abc[uint8[i] & 0x3f];
    }
    if (i === l + 1) {
        // 1 octet yet to write
        result += base64abc[uint8[i - 2] >> 2];
        result += base64abc[(uint8[i - 2] & 0x03) << 4];
        result += '==';
    }
    if (i === l) {
        // 2 octets yet to write
        result += base64abc[uint8[i - 2] >> 2];
        result += base64abc[((uint8[i - 2] & 0x03) << 4) | (uint8[i - 1] >> 4)];
        result += base64abc[(uint8[i - 1] & 0x0f) << 2];
        result += '=';
    }
    return result;
}

function decodeBase64(b64: string): Uint8Array {
    const binString = atob(b64);
    const size = binString.length;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
        bytes[i] = binString.charCodeAt(i);
    }
    return bytes;
}

// inline end

const sendError = async (e: unknown, pathname: string) => {
    const error = e as Error;
    const errorType = error.name;
    const errorMessage = error.message;
    const stack = typeof error.stack === 'string' ? error.stack.split('\n') : undefined;
    const body = JSON.stringify({ errorType, errorMessage, stack });
    const runtimeErrorType = 'Runtime.UnknownReason';
    await fetch(`http://${AWS_LAMBDA_RUNTIME_API}${pathname}`, { method: 'POST', headers: { 'Lambda-Runtime-Function-Error-Type': runtimeErrorType }, body });
}

const { module, workerEnv } = await (async () => {
    try {
        const module = await import('.' + '/worker.ts');
        const workerEnv: Record<string, unknown> = {};
        for (const [ envName, envValue ] of Object.entries(envObj)) {
            const m = /^BINDING_(.+?)$/.exec(envName);
            if (!m) continue;
            const bindingName = m[1];
            const obj = tryParseJson(envValue);
            if (obj === undefined || !isStringRecord(obj)) throw new Error(`Invalid '${bindingName}' binding value: ${envValue}`);
            const { value, secret } = obj;
            if (typeof value === 'string') {
                // text binding
                workerEnv[bindingName] = value;
            } else if (typeof secret === 'string') {
                // secret binding
                workerEnv[bindingName] = secret;
            }
        }
        return { module, workerEnv };
    } catch (e) {
        console.error(`${e.stack || e}`);
        await sendError(e, `/2018-06-01/runtime/init/error`);
        Deno.exit(1);
    }
})();
const initTime = Date.now();

while (true) {
    const res = await fetch(`http://${AWS_LAMBDA_RUNTIME_API}/2018-06-01/runtime/invocation/next`);
    const requestTime = Date.now();
    const [ awsRequestId, deadlineMillisStr, invokedFunctionArn, traceId ] = [
        'Lambda-Runtime-Aws-Request-Id', 
        'Lambda-Runtime-Deadline-Ms', 
        'Lambda-Runtime-Invoked-Function-Arn',
        'Lambda-Runtime-Trace-Id',
    ].map(name => { 
        const value = res.headers.get(name); 
        if (typeof value !== 'string') throw new Error(`No ${name} response header!`);
        return value;
    });
    try {
        Deno.env.set('_X_AMZN_TRACE_ID', traceId);
        const nextStatus = res.status;
        const nextHeaders = [...res.headers].map(v => v.join(': '));
        const requestContentType = res.headers.get('content-type');
        const request = requestContentType === 'application/json' ? await res.json() : await res.text();

        let body = '';
        if (isLambdaHttpRequest(request)) {
            // http request from function url
            const { requestContext } = request;
            const url = new URL(`https://${requestContext.domainName}${request.rawPath}${request.rawQueryString === '' ? '' : `?${request.rawQueryString}`}`);
            const method = requestContext.http.method;
            const requestHeaders = new Headers(request.headers);
            const moduleRequestBody: BodyInit | undefined = request.body === undefined ? undefined : request.isBase64Encoded ? decodeBase64(request.body) : request.body;
            requestHeaders.set('cf-connecting-ip', requestContext.http.sourceIp);
            const lambda: LambdaWorkerInfo = { 
                times: { bootstrap: bootstrapTime, start: startTime, init: initTime, request: requestTime, dispatch: Date.now(), deadline: parseInt(deadlineMillisStr) }, 
                request,
                env: envObj,
                awsRequestId,
                invokedFunctionArn,
                traceId,
            }
            const work: Promise<unknown>[] = [];
            const waitUntil = (promise: Promise<unknown>) => {
                work.push(promise);
            };
            const passThroughOnException = () => {
                throw new Error(`passThroughOnException not supported on lambda!`);
            }
            const context: LambdaWorkerContext = { lambda, waitUntil, passThroughOnException };
            const moduleRequest = new Request(url, { method, headers: requestHeaders, body: moduleRequestBody });
            // deno-lint-ignore no-explicit-any
            (moduleRequest as any).cf = { colo: envObj['AWS_REGION'] };
            const moduleResponse = await module.default.fetch(moduleRequest, workerEnv, context) as Response;
            if (work.length > 0) await Promise.allSettled(work);
            let buf = await moduleResponse.arrayBuffer();
            const headers = Object.fromEntries(moduleResponse.headers);
            const originalSize = buf.byteLength;
            if (originalSize > 1024 * 1024 * 3 && !moduleResponse.headers.has('content-encoding')) {
                // gzip manually to try and stay under 6 MB response limit
                // don't forget about base64 overhead
                const gzipStream = new Response(buf).body!.pipeThrough(new CompressionStream('gzip'));
                buf = await new Response(gzipStream).arrayBuffer();
                headers['content-encoding'] = 'gzip';
                console.log(`Force gzipped ${formatSize(originalSize)} to ${formatSize(buf.byteLength)}`);
            }
            const moduleResponseBodyBase64 = encodeBase64(new Uint8Array(buf));
            body = JSON.stringify({ statusCode: moduleResponse.status, headers, body: moduleResponseBodyBase64, isBase64Encoded: true });
            console.log(`responsebody.length=${body.length}`);
        } else {
            const rt: Record<string, unknown> = { env: Deno.env.toObject(), awsRequestId, deadlineMillisStr, invokedFunctionArn, traceId, request, nextStatus, nextHeaders, bootstrapTime, startTime, initTime, requestTime };
            console.log(JSON.stringify(rt, undefined, 2));
            body = `${JSON.stringify(rt)}`;
        }
        await fetch(`http://${AWS_LAMBDA_RUNTIME_API}/2018-06-01/runtime/invocation/${awsRequestId}/response`, { method: 'POST', body });
    } catch (e) {
        console.error(`error handling request: ${e.stack || e}`);
        await sendError(e, `/2018-06-01/runtime/invocation/${awsRequestId}/error`);
    }
}

// deno-lint-ignore no-explicit-any
function isStringRecord(obj: any): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && obj.constructor === Object;
}

function isLambdaHttpRequest(obj: unknown): obj is LambdaHttpRequest {
    return isStringRecord(obj) && isStringRecord(obj.requestContext)
}

// deno-lint-ignore no-explicit-any
function tryParseJson(text: string): any {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

function formatSize(sizeInBytes: number): string {
    const sign = sizeInBytes < 0 ? '-' : '';
    let size = Math.abs(sizeInBytes);
    if (size < 1024) return `${sign}${size}bytes`;
    size = size / 1024;
    if (size < 1024) return `${sign}${roundToOneDecimal(size)}kb`;
    size = size / 1024;
    return `${sign}${roundToOneDecimal(size)}mb`;
}

function roundToOneDecimal(value: number): number {
    return Math.round(value * 10) / 10;
}
