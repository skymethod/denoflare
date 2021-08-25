/// <reference lib="dom" />

import { css, html } from '../deps_app.ts';
import { TailwebAppVM } from '../tailweb_app_vm.ts';

export const CONSOLE_HTML = html`
<div id="console">
    <div id="console-settings"></div>
    <div id="console-last-line" class="line">spacer</div>
</div>

`;

export const CONSOLE_CSS = css`

#console {
    font-family: monospace;
    color: var(--high-emphasis-text-color);
    height: 100vh;
    width: 100%;
    background-color: #121212;
    overflow-y: scroll;
    overflow-x: hidden;
}

#console::-webkit-scrollbar {
    width: 1rem;
    height: 3rem;
    background-color: #121212;
}

#console::-webkit-scrollbar-thumb {
    background-color: var(--medium-emphasis-text-color);
}

#console-settings {
    position: sticky;
    top: 0;
    height: 5rem;
    background-color: #121212;
}

#console .line {
    padding: 0.1rem 0;
}

#console-last-line {
    visibility: hidden;
}

`;

export function initConsole(document: HTMLDocument, vm: TailwebAppVM): () => void {
    const consoleDiv = document.getElementById('console') as HTMLDivElement;
    const consoleLastLineDiv = document.getElementById('console-last-line') as HTMLDivElement;
    vm.logger = (...data) => {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'line';
        const msg = data[0];
        const tokens = msg.split('%c');
        for (let i = 0; i < tokens.length; i++) {
            const span = document.createElement('SPAN');
            const style = data[i];
            span.setAttribute('style', style);
            span.textContent = tokens[i];
            lineDiv.appendChild(span);
        }
        consoleDiv.insertBefore(lineDiv, consoleLastLineDiv);
        consoleLastLineDiv.scrollIntoView(false /* alignToTop */);
    };

    // for (let i = 0; i < 100; i++) vm.logger(`item ${i}`); // generate a bunch of lines to test scrolling

    return () => {

    };
}
