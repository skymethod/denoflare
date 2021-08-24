/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { CloudflareApi, createTail } from '../common/cloudflare_api.ts';
import { TailMessage } from '../common/tail.ts';
import { ErrorInfo, TailConnection, TailConnectionCallbacks } from '../common/tail_connection.ts';
import { dumpMessagePretty } from '../common/tail_pretty.ts';
import { initSidebar, SIDEBAR_CSS, SIDEBAR_HTML } from './sidebar_view.ts';
import { TailwebAppVM } from './tailweb_app_vm.ts';
import { css, html, LitElement } from './deps_app.ts';
import { MATERIAL_CSS } from './material.ts';
import { initModals, MODALS_HTML } from './modals.ts';
import { HEADER_CSS, HEADER_HTML, initHeader } from './header_view.ts';

const appCss = css`

main {
    display: flex;
}

`;

const appHtml = html`
${HEADER_HTML}
<main>
${SIDEBAR_HTML}
<div id="content">
</div>
${MODALS_HTML}
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
]);

LitElement.render(appHtml, document.body);

const vm = new TailwebAppVM();
const updateHeader = initHeader(document, vm);
const updateSidebar = initSidebar(document, vm);
const updateModals = initModals(document, vm);

vm.onchange = () => {
    updateHeader();
    updateSidebar();
    updateModals();
};

vm.start();

if (false) {
    const accountId = '';
    const apiToken = '';
    const scriptName = '';
    try {
        CloudflareApi.URL_TRANSFORMER = v => `/fetch/${v.substring('https://'.length)}`;
        const tail = await createTail(accountId, scriptName, apiToken);
        document.body.appendChild(document.createTextNode(JSON.stringify(tail, undefined, 2)));

        // deno-lint-ignore no-explicit-any
        const logger = (...data: any[]) => {
            const div = document.createElement('DIV');
            const msg = data[0];
            const tokens = msg.split('%c');
            for (let i = 0; i < tokens.length; i++) {
                const span = document.createElement('SPAN');
                const style = data[i];
                span.setAttribute('style', style);
                span.textContent = tokens[i];
                div.appendChild(span);
            }
            document.body.appendChild(div);
        };
        const callbacks: TailConnectionCallbacks = {
            onOpen(_cn: TailConnection, timeStamp: number) {
                console.log('open', { timeStamp });
            },
            onClose(_cn: TailConnection, timeStamp: number, code: number, reason: string, wasClean: boolean) {
                console.log('close', { timeStamp, code, reason, wasClean });
            },
            onError(_cn: TailConnection, timeStamp: number, errorInfo?: ErrorInfo) {
                console.log('error', { timeStamp, errorInfo });
            },
            onTailMessage(_cn: TailConnection, timeStamp: number, message: TailMessage) {
                console.log('tailMessage', { timeStamp, message });
                dumpMessagePretty(message, logger);
            },
            // deno-lint-ignore no-explicit-any
            onUnparsedMessage(_cn: TailConnection, timeStamp: number, message: any, parseError: Error) {
                console.log('unparsedMessage', { timeStamp, message, parseError });
            },
        };
        const _cn = new TailConnection(tail.url, callbacks);
        
    } catch (e) {
        document.body.appendChild(document.createTextNode(e.stack));
    }
}
