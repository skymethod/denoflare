import { IncomingRequestCf, ModuleWorkerContext } from '../deps_cf.ts';
import { TAILWEB_APP_DATA } from './tailweb_data.ts';

export default {

    async fetch(request: IncomingRequestCf, _env: WorkerEnv, _ctx: ModuleWorkerContext): Promise<Response> {
        const cfConnectingIp = request.headers.get('cf-connecting-ip');
        const url = new URL(request.url);

        if (url.pathname === '/') {
            return new Response(computeHtml(url), { headers: { 'Content-Type': 'text/html; charset=utf-8' }});
        } else if (url.pathname === '/app.js') {
            const response = await fetch(TAILWEB_APP_DATA);
            return new Response(await response.blob(), { headers: { 'Content-Type': 'text/javascript; charset=utf-8' }});
        }

        return new Response(`hello ${cfConnectingIp}`);
    },

};

// deno-lint-ignore no-empty-interface
export interface WorkerEnv {
    
}

//

function computeHtml(url: URL) {
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

<link rel="stylesheet" href="/styles.css">

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
<meta name="theme-color" content="#FF00FF">
</head>

<body>
<script src="/app.js" type="module"></script>
</body>
</html>`;
}
