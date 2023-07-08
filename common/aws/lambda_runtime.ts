import type { LambdaHttpRequest } from './lambda_runtime.d.ts';

const runtimeStartTime = Date.now();

const AWS_LAMBDA_RUNTIME_API = Deno.env.get('AWS_LAMBDA_RUNTIME_API');

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
        for (const [ envName, envValue ] of Object.entries(Deno.env.toObject())) {
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
        await sendError(e, `/2018-06-01/runtime/init/error`);
        Deno.exit(1);
    }
})();

while (true) {
    const res = await fetch(`http://${AWS_LAMBDA_RUNTIME_API}/2018-06-01/runtime/invocation/next`);
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
            const headers = new Headers(request.headers);
            const moduleRequestBody: BodyInit | undefined = request.body === undefined ? undefined : request.isBase64Encoded ? base64Decode(request.body, false) : request.body;
            headers.set('cf-connecting-ip', requestContext.http.sourceIp);
            const lambda = { request, runtimeStartTime, env: Deno.env.toObject(), awsRequestId, deadlineMillisStr, invokedFunctionArn, traceId, nextStatus, nextHeaders };
            const moduleResponse = await module.default.fetch(new Request(url, { method, headers, body: moduleRequestBody }), workerEnv, { lambda });
            const moduleResponseBodyBase64 = base64Encode(new Uint8Array(await moduleResponse.arrayBuffer()));
            body = JSON.stringify({ statusCode: moduleResponse.status, headers: Object.fromEntries(moduleResponse.headers), body: moduleResponseBodyBase64, isBase64Encoded: true });
        } else {
            const rt: Record<string, unknown> = { env: Deno.env.toObject(), awsRequestId, deadlineMillisStr, invokedFunctionArn, traceId, request, nextStatus, nextHeaders, runtimeStartTime };
            console.log(JSON.stringify(rt, undefined, 2));
            body = `${JSON.stringify(rt)}`;
        }
        await fetch(`http://${AWS_LAMBDA_RUNTIME_API}/2018-06-01/runtime/invocation/${awsRequestId}/response`, { method: 'POST', body });
    } catch (e) {
        await sendError(e, `/2018-06-01/runtime/invocation/${awsRequestId}/error`);
    }
}

// deno-lint-ignore no-explicit-any
function isStringRecord(obj: any): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && obj.constructor === Object;
}

function base64Encode(buf: Uint8Array): string {
    let string = '';
    (buf).forEach(
        (byte) => { string += String.fromCharCode(byte) }
    )
    return btoa(string);
}

function base64Decode(str: string, urlSafe: boolean): Uint8Array {
    if (urlSafe) str = str.replace(/_/g, '/').replace(/-/g, '+');
    str = atob(str);
    const
        length = str.length,
        buf = new ArrayBuffer(length),
        bufView = new Uint8Array(buf);
    for (let i = 0; i < length; i++) { bufView[i] = str.charCodeAt(i) }
    return bufView;
}

function isLambdaHttpRequest(obj: unknown): obj is LambdaHttpRequest {
    return isStringRecord(obj) && isStringRecord(obj.requestContext)
}

function tryParseJson(text: string): any {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}
