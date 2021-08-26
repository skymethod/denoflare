import { Bytes } from '../common/bytes.ts';
import { IncomingRequestCf, ModuleWorkerContext } from '../common/deps_cf.ts';
import { TAILWEB_APP_B64, TAILWEB_APP_HASH } from './tailweb_data.ts';
import { Material } from './material.ts';

export default {

    async fetch(request: IncomingRequestCf, _env: WorkerEnv, _ctx: ModuleWorkerContext): Promise<Response> {
        const cfConnectingIp = request.headers.get('cf-connecting-ip');
        const url = new URL(request.url);

        if (url.pathname === '/') {
            return new Response(computeHtml(url), { headers: { 'Content-Type': 'text/html; charset=utf-8' }});
        } else if (url.pathname === computeAppJsPath()) {
            return computeAppResponse();
        } else if (url.pathname.startsWith('/fetch/')) {
            const fetchUrlStr = 'https://' + url.pathname.substring('/fetch/'.length);
            const fetchUrl = new URL(fetchUrlStr);
            const { method } = request;
            if (isFetchAllowed(method, fetchUrl)) {
                const headers = [...request.headers].filter(v => !v[0].startsWith('cf-'));
                const body = undefined;
                return await fetch(fetchUrlStr, { method, headers, body });
            }
            throw new Response(`Unable to fetch ${fetchUrl}`, { status: 400 });
        }

        return new Response(`hello ${cfConnectingIp}`);
    },

};

// deno-lint-ignore no-empty-interface
export interface WorkerEnv {
    
}

//

function isFetchAllowed(method: string, url: URL): boolean {
    return /^(GET|POST)$/.test(method) 
        && url.origin === 'https://api.cloudflare.com'
        && url.pathname.startsWith('/client/v4/accounts/') 
        && url.pathname.includes('/workers/scripts');
}

function computeAppJsPath(): string {
    return `/app.${TAILWEB_APP_HASH}.js`;
}

function computeAppResponse(): Response {
    const array = Bytes.ofBase64(TAILWEB_APP_B64).array();
    return new Response(array, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=604800, immutable' }});
}

function computeHtml(url: URL) {
    const appJsPath = computeAppJsPath();
        return `<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title>Denoflare Tail</title>

<script type="module">
    document.documentElement.classList.remove('no-js');
    document.documentElement.classList.add('js');
</script>

<link rel="modulepreload" href="${appJsPath}" as="script" />
<script type="module" src="${appJsPath}"></script>

<meta name="description" content="Page description">
<meta property="og:title" content="Unique page title - My Site">
<meta property="og:description" content="Page description">
<meta property="og:image" content="${url.origin}/image.jpg">
<meta property="og:image:alt" content="Image description">
<meta property="og:locale" content="en_US">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta property="og:url" content="${url.origin}/page">
<link rel="canonical" href="${url.origin}/page">

<link rel="icon" href="/favicon.ico">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/my.webmanifest">
<meta name="theme-color" content="${Material.primaryColorHex}">

<style>
body {
    font-family: -apple-system, BlinkMacSystemFont, avenir next, avenir, helvetica neue, helvetica, Ubuntu, roboto, noto, segoe ui, arial, sans-serif;
    background-color: ${Material.backgroundColorHex};
    color: red; /* to catch non-explicit text colors */
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

</style>
</head>
<body></body>
</html>`;
}
