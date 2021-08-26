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
    background-color: var(--background-color);
    overflow-y: scroll;
    overflow-x: hidden;
    flex-grow: 1;
}

#console::-webkit-scrollbar {
    width: 1rem;
    height: 3rem;
    background-color: var(--background-color);
}

#console::-webkit-scrollbar-thumb {
    background-color: var(--medium-emphasis-text-color);
}

#console-settings {
    position: sticky;
    top: 0;
    height: 5rem;
    background-color: var(--background-color);
}

#console .line {
    padding: 0.1rem 0;
    white-space: pre;
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
        let pos = 0;
        while (pos < data.length) {
            const msg = data[pos];
            if (typeof msg === 'string') {
                const tokens = msg.split('%c');
                for (let i = 0; i < tokens.length; i++) {
                    const span = document.createElement('span');
                    if (i > 0 && i < tokens.length - 1) {
                        const style = data[pos + i];
                        span.setAttribute('style', style);
                    }
                    renderTextIntoSpan(tokens[i], span);
                    lineDiv.appendChild(span);
                }
                pos += 1 + tokens.length - 1;
            } else {
                lineDiv.textContent = JSON.stringify(msg);
                pos++;
            }
        }

        consoleDiv.insertBefore(lineDiv, consoleLastLineDiv);
        const { scrollHeight, scrollTop, clientHeight } = consoleDiv;
        const diff = scrollHeight - scrollTop;
        const autoscroll = diff - 16 * 4 <= clientHeight;
        // console.log({scrollHeight, scrollTop, clientHeight, diff, autoscroll });
        if (autoscroll) {
            consoleLastLineDiv.scrollIntoView(false /* alignToTop */);
        }
    };

    // for (let i = 0; i < 100; i++) vm.logger(`line ${i}`); // generate a bunch of lines to test scrolling
    // setInterval(() => { vm.logger(`line ${new Date().toISOString()}`); }, 1000); // generate a line every second to test autoscroll

    return () => {

    };
}

//

function renderTextIntoSpan(text: string, span: HTMLSpanElement) {
    const pattern = /https:\/\/[^\s]+/g;
    let m: RegExpExecArray | null;
    let i = 0;
    while(null !== (m = pattern.exec(text))) {
        if (m.index > i) {
            span.appendChild(document.createTextNode(text.substring(i, m.index)));
        }
        const url = m[0];
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.appendChild(document.createTextNode(url));
        span.appendChild(a);
        i = m.index + url.length;
    }
    if (i < text.length) {
        span.appendChild(document.createTextNode(text.substring(i)));
    }
}
