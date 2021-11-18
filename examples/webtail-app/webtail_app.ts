/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { initSidebar, SIDEBAR_CSS, SIDEBAR_HTML } from './views/sidebar_view.ts';
import { WebtailAppVM } from './webtail_app_vm.ts';
import { CloudflareApi, css, html, LitElement } from './deps_app.ts';
import { MATERIAL_CSS } from './material.ts';
import { initModal, MODAL_CSS, MODAL_HTML } from './views/modal_view.ts';
import { HEADER_CSS } from './views/header_view.ts';
import { PROFILE_EDITOR_CSS } from './views/profile_editor_view.ts';
import { CIRCULAR_PROGRESS_CSS } from './views/circular_progress_view.ts';
import { CONSOLE_CSS, CONSOLE_HTML, initConsole } from './views/console_view.ts';
import { FILTER_EDITOR_CSS } from './views/filter_editor_view.ts';
import { StaticData } from './static_data.ts';
import { WELCOME_PANEL_CSS } from './views/welcome_panel.ts';
import { ANALYTICS_HTML, ANALYTICS_CSS, initAnalytics } from './views/analytics_view.ts';
import { CfGqlClient } from '../../common/analytics/cfgql_client.ts';

const appModuleScript = document.getElementById('app-module-script') as HTMLScriptElement;

function setAppState(appState: string) {
    appModuleScript.dataset.state = appState;
}
setAppState('starting');

const appCss = css`

main {
    display: flex;
    gap: 0.5rem;
}

:root {
    --pure-material-primary-rgb: rgb(187, 134, 252);
}

.hidden-vertical-scroll {
    scrollbar-width: none; -ms-overflow-style: none;
    overflow-y: scroll;
}

.hidden-vertical-scroll::-webkit-scrollbar {
    display: none; /* for Chrome, Safari, and Opera */
}

`;

const appHtml = html`
<main>
${SIDEBAR_HTML}
${CONSOLE_HTML}
${ANALYTICS_HTML}
${MODAL_HTML}
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
    HEADER_CSS.cssText, 
    SIDEBAR_CSS.cssText,
    CONSOLE_CSS.cssText,
    ANALYTICS_CSS.cssText,
    MODAL_CSS.cssText,
    WELCOME_PANEL_CSS.cssText,
    PROFILE_EDITOR_CSS.cssText,
    FILTER_EDITOR_CSS.cssText,
    CIRCULAR_PROGRESS_CSS.cssText,
]);

LitElement.render(appHtml, document.body);

function parseStaticData(): StaticData {
    const script = document.getElementById('static-data-script') as HTMLScriptElement;
    const data = JSON.parse(script.text);
    const version = typeof data.version === 'string' ? data.version : undefined;
    const flags = typeof data.flags === 'string' ? data.flags : undefined;
    return { version, flags };
}

const data = parseStaticData();

const vm = new WebtailAppVM();
const updateSidebar = initSidebar(document, vm, data);
const updateConsole = initConsole(document, vm);
const updateAnalytics = initAnalytics(document, vm);
const updateModal = initModal(document, vm);

vm.onChange = () => {
    updateSidebar();
    updateConsole();
    updateAnalytics();
    updateModal();
};

CloudflareApi.URL_TRANSFORMER = CfGqlClient.URL_TRANSFORMER = v => `/fetch/${v.substring('https://'.length)}`;
vm.start();

setAppState('started');
