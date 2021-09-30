import { Client } from './client.ts';
import { DurableObjectNamespace, IncomingRequestCf, ModuleWorkerContext } from './deps.ts';
import { getIsolateId } from './isolate_id.ts';
import { Server } from './server.ts';
import { TieredWorkerEnv } from './tiered_worker_env.d.ts';
export { ColoTierDO } from './colo_tier_do.ts';
import * as _ from './globals.d.ts';

// Hosted version: https://tiered-websockets.denoflare.dev

export default {

    async fetch(request: IncomingRequestCf, env: TieredWorkerEnv, _ctx: ModuleWorkerContext): Promise<Response> {
        const { colo } = request.cf;
        const isolateId = 'worker-' + getIsolateId(colo);
        const server = ensureServer(isolateId);
        const debug = await ensureConnectedToColoTier(env.ColoTierDO, colo, isolateId, server);
        const url = new URL(request.url);
        const { headers } = request;
        const { pathname } = url;
        if (pathname === '/') {
            const clientId = 'browser-' + (headers.get('cf-ray') || 'unknown');
            return new Response(computeHtml(url.origin, clientId), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        const wsResponse = server.tryHandle(pathname, request, debug);
        if (wsResponse) return wsResponse;

        return new Response('not found', { status: 404 });
    }

};

//

const VERSION = 4;

let _server: Server | undefined;

function ensureServer(isolateId: string): Server {
    if (_server) return _server;
    _server = new Server(isolateId);
    return _server;
}

let _coloTierDebug = '';
let _coloTierClient: Client | undefined;

async function ensureConnectedToColoTier(coloTierNamespace: DurableObjectNamespace, colo: string, isolateId: string, server: Server): Promise<string> {
    if (_coloTierDebug !== '') return _coloTierDebug;
    const doName = colo;
    const stub = coloTierNamespace.get(coloTierNamespace.idFromName(doName));
    const res = await stub.fetch(`https://fake/ws/${isolateId}`, { headers: { 'do-name': doName, upgrade: 'websocket' }});
    
    const { webSocket } = res;
    if (webSocket) {
        webSocket.accept();
        _coloTierClient = new Client(webSocket, isolateId, data => server.broadcast({ t: 'republish', data }));
    }

    _coloTierDebug = `${res.status} ${[...Object.keys(res)].join(',')} ${[...res.headers].map(v => v.join(': ')).join(', ')}`;

    return _coloTierDebug;
}

function computeHtml(origin: string, clientId: string) {
    const wsOrigin = origin.replace('https://', 'wss://').replace('http://', 'ws://');
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Example Cloudflare Worker with multiple WebSocket tiers">

    <title>Tiered WebSockets Example Worker</title>
    <style>

* {
    box-sizing: border-box;
}

body {
    margin: 1rem 0 0 1rem;
    background: #00251a;
    color: #eee;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
}

#status {
    height: 2rem;
}

#messages {
    height: calc(100vh - 3rem);
    overflow-y: scroll;
    padding-bottom: 1rem;
}

#messages > div {
    margin-top: 0.5rem;
}

    </style>
  </head>
  <body>
    <div id="status">JavaScript disabled</div>
    <div id="messages">
    </div>
    <script>

    const statusDiv = document.getElementById("status");
    const messagesDiv = document.getElementById("messages");

    const startTextElement = function(tag, text) {
        const rt = document.createElement(tag);
        rt.textContent = text;
        return rt;
    };

    const appendMessage = function(msg) {
        const messageDiv = startTextElement("div", msg);
        messagesDiv.appendChild(messageDiv);
        messageDiv.scrollIntoView();
    };

    const setStatus = function(status) {
        statusDiv.textContent = "${'v' + VERSION + ': '}" + status;
    };

    setStatus("Connecting...");
    try {
        const storedClientId = sessionStorage.getItem("clientId");
        const clientId = storedClientId || "${clientId}";
        if (!storedClientId) sessionStorage.setItem("clientId", clientId);    
        const url = "${wsOrigin}/ws/${clientId}";
        const ws = new WebSocket(url);
        ws.addEventListener("open", event => {
            setStatus("Opened");
            appendMessage("browser: open");
            ws.send(JSON.stringify({ "t": "open", clientId }));
        });
        ws.addEventListener("message", event => {
            const msg = JSON.parse(event.data);
            appendMessage("browser: received message: " + JSON.stringify(msg, undefined, 2));
        });
        ws.addEventListener("close", event => {
            setStatus("Closed");
            appendMessage("browser: received close: code=" + event.code + ", reason=" + event.reason);
        });
        ws.addEventListener("error", event => {
            setStatus("Errored");
            appendMessage("browser: received error");
            console.warn('Error event', event);
        });
        appendMessage("browser: opening...");
    } catch (e) {
        setStatus("Closed");
        appendMessage("browser: Error setting up websocket: " + (e.stack || e));
    }

    </script>
  </body>
</html>`;
}
