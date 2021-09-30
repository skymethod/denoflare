/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { css, html, LitElement } from './deps_app.ts';
import { MATERIAL_CSS } from './material.ts';
import { StaticData } from './static_data.ts';

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

setAppState('started');
