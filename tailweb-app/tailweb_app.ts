/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { CloudflareApi } from '../common/cloudflare_api.ts';
import { initSidebar, SIDEBAR_CSS, SIDEBAR_HTML } from './views/sidebar_view.ts';
import { TailwebAppVM } from './tailweb_app_vm.ts';
import { css, html, LitElement } from './deps_app.ts';
import { MATERIAL_CSS } from './material.ts';
import { initModal, MODAL_CSS, MODAL_HTML } from './views/modal_view.ts';
import { HEADER_CSS } from './views/header_view.ts';
import { PROFILE_EDITOR_CSS } from './views/profile_editor_view.ts';
import { CIRCULAR_PROGRESS_CSS } from './views/circular_progress_view.ts';
import { CONSOLE_CSS, CONSOLE_HTML, initConsole } from './views/console_view.ts';
import { FILTER_EDITOR_CSS } from './views/filter_editor_view.ts';

const appCss = css`

main {
    display: flex;
    gap: 0.5rem;
}

:root {
    --pure-material-primary-rgb: rgb(187, 134, 252);
}
`;

const appHtml = html`
<main>
${SIDEBAR_HTML}
${CONSOLE_HTML}
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
    MODAL_CSS.cssText,
    PROFILE_EDITOR_CSS.cssText,
    FILTER_EDITOR_CSS.cssText,
    CIRCULAR_PROGRESS_CSS.cssText,
]);

LitElement.render(appHtml, document.body);

const vm = new TailwebAppVM();
const updateSidebar = initSidebar(document, vm);
const updateConsole = initConsole(document, vm);
const updateModal = initModal(document, vm);

vm.onchange = () => {
    updateSidebar();
    updateConsole();
    updateModal();
};

CloudflareApi.URL_TRANSFORMER = v => `/fetch/${v.substring('https://'.length)}`;

vm.start();
