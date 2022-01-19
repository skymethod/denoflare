import { IncomingRequestCf } from './deps_worker.ts';
import { FAVICON_SVG, FAVICON_ICO, FAVICON_VERSION } from './favicons.ts';
import { Theme } from './theme.ts';
import { AppManifest } from './app_manifest.d.ts';
import { WorkerEnv } from './worker_env.d.ts';
import { computeHomepage } from './homepage.ts';
import { TWITTER_IMAGE_PNG, TWITTER_IMAGE_VERSION } from './twitter.ts';
import { HtmlContribution } from './html.ts';
import { compute404 } from './404.ts';
import { computeImg } from './img.ts';

export default {

    async fetch(request: IncomingRequestCf, env: WorkerEnv): Promise<Response> {
        const url = new URL(request.url);
        const { pathname, origin, searchParams } = url;
        const { twitter, unsplashAppName, unsplashIxid, imgOrigin, authorHref, authorName } = env;
        const { colo } = request.cf;

        if (pathname === '/') {
            const headers = computeHeaders('text/html; charset=utf-8');
            const { name, description } = computeManifest();
            const twitterImagePathname = TWITTER_IMAGE_PNG_PATHNAME;
            const contribution = computeHomepage({ name, description, origin, twitterImagePathname, twitter, unsplashAppName, unsplashIxid, imgOrigin, authorName, authorHref });
            return new Response(computeHtml(contribution), { headers });
        } else if (pathname === FAVICON_SVG_PATHNAME) {
            const headers = computeHeaders(SVG_MIME_TYPE, { immutable: true });
            return new Response(FAVICON_SVG, { headers });
        } else if (pathname === '/favicon.ico' || pathname === FAVICON_ICO_PATHNAME) {
            const headers = computeHeaders('image/x-icon', { immutable: pathname.includes(`${FAVICON_VERSION}.`) });
            return new Response(new Uint8Array(structuredClone(FAVICON_ICO)), { headers });
        } else if (pathname === MANIFEST_PATHNAME) {
            const headers = computeHeaders('application/manifest+json', { immutable: true });
            return new Response(JSON.stringify(computeManifest(), undefined, 2), { headers });
        } else if (pathname === TWITTER_IMAGE_PNG_PATHNAME) {
            const headers = computeHeaders('image/png', { immutable: true });
            return new Response(new Uint8Array(structuredClone(TWITTER_IMAGE_PNG)), { headers });
        } else if (pathname === '/robots.txt') {
            const headers = computeHeaders('text/plain; charset=utf-8');
            return new Response('User-agent: *\nDisallow: /img\n', { headers });
        } else if (pathname === '/img') {
            return await computeImg(searchParams, { colo });
        }
        
        const headers = computeHeaders('text/html; charset=utf-8');
        return new Response(computeHtml(compute404()), { status: 404, headers });
    }

};

//

const MANIFEST_VERSION = '1';
const FAVICON_SVG_PATHNAME = `/favicon.${FAVICON_VERSION}.svg`;
const FAVICON_ICO_PATHNAME = `/favicon.${FAVICON_VERSION}.ico`;
const MANIFEST_PATHNAME = `/app.${MANIFEST_VERSION}.webmanifest`;
const TWITTER_IMAGE_PNG_PATHNAME = `/og-image.${TWITTER_IMAGE_VERSION}.png`;
const SVG_MIME_TYPE = 'image/svg+xml';

function computeManifest(): AppManifest {
    const name = 'Transform Images in a Cloudflare Worker';
    return {
        'short_name': name,
        name,
        description: 'Transforms images inside a Cloudflare Worker using WebAssembly.',
        icons: [
            { 
                src: FAVICON_SVG_PATHNAME,
                type: SVG_MIME_TYPE,
            },
        ],
        'theme_color': Theme.primaryColor900Hex,
        'background_color': Theme.backgroundColorHex,
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

function encodeHtml(value: string): string {
    return value.replace(/&/g, '&amp;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

const ICONS_MANIFEST_AND_THEME_COLORS = `
  <link rel="icon" href="${FAVICON_ICO_PATHNAME}">
  <link rel="icon" href="${FAVICON_SVG_PATHNAME}" type="${SVG_MIME_TYPE}">
  <link rel="mask-icon" href="${FAVICON_SVG_PATHNAME}" color="${Theme.primaryColor200Hex}">
  <link rel="manifest" href="${MANIFEST_PATHNAME}">
  <meta name="theme-color" content="${Theme.primaryColor900Hex}" media="(prefers-color-scheme: dark)">
  <meta name="theme-color" content="${Theme.primaryColor900Hex}">
`;

function computeHtml(contribution: HtmlContribution) {
    const { title, headContribution, body } = contribution;
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${encodeHtml(title)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
${ICONS_MANIFEST_AND_THEME_COLORS}
${headContribution || ''}
</head>
${body}
</html>`;
}
