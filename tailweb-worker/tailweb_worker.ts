import { Bytes } from '../common/bytes.ts';
import { IncomingRequestCf, ModuleWorkerContext } from '../common/deps_cf.ts';
import { TAILWEB_APP_B64, TAILWEB_APP_HASH } from './tailweb_data.ts';
import { FAVICON_SVG, FAVICON_ICO_B64, FAVICON_VERSION } from './favicons.ts';
import { TWITTER_IMAGE_VERSION, TWITTER_IMAGE_JPG_B64 } from './twitter.ts';
import { Material } from './material.ts';
import { AppManifest } from './app_manifest.d.ts';

export default {

    async fetch(request: IncomingRequestCf, env: WorkerEnv, _ctx: ModuleWorkerContext): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === '/') {
            const { version, flags } = env;
            const headers = computeHeaders('text/html; charset=utf-8');
            return new Response(computeHtml(url, { version, flags }), { headers });
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
        } else if (url.pathname === FAVICON_SVG_PATHNAME) {
            const headers = computeHeaders(SVG_MIME_TYPE, { immutable: true });
            return new Response(FAVICON_SVG, { headers });
        } else if (url.pathname === '/favicon.ico' || url.pathname === FAVICON_ICO_PATHNAME) {
            const headers = computeHeaders('image/x-icon', { immutable: url.pathname.includes(`${FAVICON_VERSION}.`) });
            return new Response(Bytes.ofBase64(FAVICON_ICO_B64).array(), { headers });
        } else if (url.pathname === MANIFEST_PATHNAME) {
            const headers = computeHeaders('application/manifest+json', { immutable: true });
            return new Response(JSON.stringify(computeManifest(url), undefined, 2), { headers });
        } else if (url.pathname === TWITTER_IMAGE_JPG_PATHNAME) {
            const headers = computeHeaders('image/jpeg', { immutable: true });
            return new Response(Bytes.ofBase64(TWITTER_IMAGE_JPG_B64).array(), { headers });
        }
        
        return new Response('not found', { status: 404 });
    }

};

export interface WorkerEnv {
    readonly version?: string;
    readonly flags?: string;
}

//

const MANIFEST_VERSION = '1';
const FAVICON_SVG_PATHNAME = `/favicon.${FAVICON_VERSION}.svg`;
const FAVICON_ICO_PATHNAME = `/favicon.${FAVICON_VERSION}.ico`;
const MANIFEST_PATHNAME = `/app.${MANIFEST_VERSION}.webmanifest`;
const TWITTER_IMAGE_JPG_PATHNAME = `/og-image.${TWITTER_IMAGE_VERSION}.jpg`;
const SVG_MIME_TYPE = 'image/svg+xml';

function computeManifest(url: URL): AppManifest {
    const name = 'Denoflare Tail';
    return {
        'short_name': name,
        name: `${name} (${url.hostname})`,
        description: 'View real-time requests and logs from Cloudflare Workers from the comfort of your browser.',
        icons: [
            { 
                src: FAVICON_SVG_PATHNAME,
                type: SVG_MIME_TYPE,
            },
        ],
        'theme_color': Material.primaryColor900Hex,
        'background_color': Material.backgroundColorHex,
        display: 'standalone',
        start_url: '/',
        lang: 'en-US',
        dir: 'ltr',
    };
}

function computeHeaders(contentType: string, opts: { immutable?: boolean } = {}) {
    const { immutable } = opts;
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    if (immutable) headers.set('Cache-Control', 'public, max-age=604800, immutable');
    return headers;
}

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
    return new Response(array, { headers: computeHeaders('text/javascript; charset=utf-8', { immutable: true }) });
}

function encodeHtml(value: string): string {
    return value.replace(/&/g, '&amp;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function computeHtml(url: URL, staticData: Record<string, unknown>) {
    const { short_name: name, description } = computeManifest(url);

    const appJsPath = computeAppJsPath();
        return `<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title>${encodeHtml(name)}</title>

<script id="static-data-script" type="application/json">${JSON.stringify(staticData)}</script>
<script type="module">
    document.documentElement.classList.remove('no-js');
    document.documentElement.classList.add('js');
</script>

<link rel="modulepreload" href="${appJsPath}" as="script" />
<script type="module" src="${appJsPath}"></script>

<meta name="description" content="${encodeHtml(description)}">
<meta property="og:title" content="${encodeHtml(name)}">
<meta property="og:description" content="${encodeHtml(description)}">
<meta property="og:image" content="${url.origin}${TWITTER_IMAGE_JPG_PATHNAME}">
<meta property="og:image:alt" content="${encodeHtml(name)} screenshot">
<meta property="og:locale" content="en_US">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta property="og:url" content="${url.origin}">
<link rel="canonical" href="${url.origin}">

<link rel="icon" href="${FAVICON_ICO_PATHNAME}">
<link rel="icon" href="${FAVICON_SVG_PATHNAME}" type="${SVG_MIME_TYPE}">
<link rel="mask-icon" href="${FAVICON_SVG_PATHNAME}" color="${Material.primaryColor200Hex}">
<link rel="manifest" href="${MANIFEST_PATHNAME}">
<meta name="theme-color" content="${Material.primaryColor900Hex}" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="${Material.primaryColor900Hex}">

<style>
body {
    font-family: ${Material.sansSerifFontFamily};
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
