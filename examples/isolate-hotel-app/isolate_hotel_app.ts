/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { css, html, LitElement } from './deps_app.ts';
import { MATERIAL_CSS } from './material.ts';
import { StaticData } from './static_data.ts';
import { generateUuid } from '../../common/uuid_v4.ts';

const appModuleScript = document.getElementById('app-module-script') as HTMLScriptElement;

function setAppState(appState: string) {
    appModuleScript.dataset.state = appState;
}
setAppState('starting');

const appCss = css`

`;

const appHtml = html`
<main>

</main>`;

function appendStylesheets(cssTexts: string[]) {
    const styleSheet = document.createElement('style');
    styleSheet.type = 'text/css';
    styleSheet.textContent = cssTexts.join('\n\n');
    document.head.appendChild(styleSheet);
}

appendStylesheets([
    MATERIAL_CSS.cssText, 
    appCss.cssText, 
]);

LitElement.render(appHtml, document.body);

function parseStaticData(): StaticData {
    const script = document.getElementById('static-data-script') as HTMLScriptElement;
    const data = JSON.parse(script.text);
    const version = typeof data.version === 'string' ? data.version : undefined;
    const flags = typeof data.flags === 'string' ? data.flags : undefined;
    const debug = typeof data.debug === 'object' ? data.debug : undefined;
    return { version, flags, debug };
}

const _data = parseStaticData();

console.log('TODO the client app');

const clientId = initClientId();

const ws = new WebSocket(document.location.origin.replace('https://', 'wss://').replace('http://', 'ws://') + `/ws/${clientId}`);

ws.onopen = _ev => {
    console.log('open');
};
ws.onmessage = ev => {
    console.log('onmessage', ev.data);
};
ws.onerror = _ev => {
    console.warn('onerror');
};
ws.onclose = ev => {
    const { code, reason, wasClean } = ev;
    console.warn('onclose', {code, reason, wasClean });
};
setAppState('started');

function initClientId(): string {
    let clientId = localStorage.getItem('clientId');
    if (typeof clientId === 'string' && /^[0-9a-f]{16}$/.test(clientId)) return clientId;
    clientId = generateUuid().split('-').slice(3).join('');
    console.log(`Generated clientId=${clientId}`);
    localStorage.setItem('clientId', clientId);
    return clientId;
}
