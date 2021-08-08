export function cloneRequestWithHostname(request: Request, hostname: string): Request {
    const url = new URL(request.url);
    if (url.hostname === hostname) return request;
    const newUrl = url.origin.replace(url.host, hostname) + request.url.substring(url.origin.length);
    console.log(`cloneRequestWithHostname: ${url} + ${hostname} = ${newUrl}`);
    const { method, headers } = request;
    const body = (method === 'GET' || method === 'HEAD') ? undefined : request.body;
    return new Request(newUrl, { method, headers, body });
}
