/// <reference lib="dom" />

import { css, html, LitElement } from '../deps_app.ts';
import { FilterState, TailwebAppVM } from '../tailweb_app_vm.ts';

export const CONSOLE_HTML = html`
<div id="console">
    <div id="console-header">
        <div id="console-header-filters" class="body2"></div>
        <div id="console-header-tails" class="overline medium-emphasis-text"></div>
    </div>
    <code id="console-last-line" class="line">spacer</code>
</div>

`;

export const CONSOLE_CSS = css`

#console {
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

#console-header {
    position: sticky;
    top: 0;
    height: 3.5rem;
    background-color: var(--background-color);
    display: flex;
    gap: 1rem;
    padding: 1rem 1rem 1rem 0;
}

#console-header-filters {
    flex-grow: 1;
    color: var(--medium-emphasis-text-color);
    font-family: var(--sans-serif-font-family);
}

#console-header-tails {
    white-space: nowrap;
    min-width: 4rem;
}

#console .line {
    display: block;
    font-size: 0.75rem; /* 12px */
    line-height: 1.1rem;
    font-family: var(--monospace-font-family);
    white-space: pre-wrap;
}

#console-last-line {
    visibility: hidden;
}

`;

export function initConsole(document: HTMLDocument, vm: TailwebAppVM): () => void {
    const consoleDiv = document.getElementById('console') as HTMLDivElement;
    const consoleHeaderFiltersDiv = document.getElementById('console-header-filters') as HTMLDivElement;
    const consoleHeaderTailsDiv = document.getElementById('console-header-tails') as HTMLDivElement;
    const consoleLastLineElement = document.getElementById('console-last-line') as HTMLElement;
    vm.logger = (...data) => {
        const lineElement = document.createElement('code');
        lineElement.className = 'line';
        let pos = 0;
        while (pos < data.length) {
            if (pos > 0) {
                lineElement.appendChild(document.createTextNode(', '));
            }
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
                    lineElement.appendChild(span);
                }
                pos += 1 + tokens.length - 1;
            } else {
                lineElement.appendChild(document.createTextNode(JSON.stringify(msg)));
                pos++;
            }
        }

        consoleDiv.insertBefore(lineElement, consoleLastLineElement);
        const { scrollHeight, scrollTop, clientHeight } = consoleDiv;
        const diff = scrollHeight - scrollTop;
        const autoscroll = diff - 16 * 4 <= clientHeight;
        // console.log({scrollHeight, scrollTop, clientHeight, diff, autoscroll });
        if (autoscroll) {
            consoleLastLineElement.scrollIntoView(false /* alignToTop */);
        }
    };

    // for (let i = 0; i < 100; i++) vm.logger(`line ${i}`); // generate a bunch of lines to test scrolling
    // setInterval(() => { vm.logger(`line ${new Date().toISOString()}`); }, 1000); // generate a line every second to test autoscroll

    return () => {
        consoleHeaderTailsDiv.textContent = computeTailsText(vm.tails.size);
        LitElement.render(FILTERS_HTML(vm), consoleHeaderFiltersDiv);
    };
}

//

const FILTERS_HTML = (vm: TailwebAppVM) => {
    return html`Showing <a href="#" @click=${(e: Event) => { e.preventDefault(); vm.editEventFilter(); }}>${computeEventFilterText(vm.filter)}</a>
     with <a href="#" @click=${(e: Event) => { e.preventDefault(); vm.editStatusFilter(); }}>${computeStatusFilterText(vm.filter)}</a>,
     <a href="#" @click=${(e: Event) => { e.preventDefault(); vm.editIpAddressFilter(); }}>${computeIpAddressFilterText(vm.filter)}</a>,
     <a href="#" @click=${(e: Event) => { e.preventDefault(); vm.editMethodFilter(); }}>${computeMethodFilterText(vm.filter)}</a>,
     <a href="#" @click=${(e: Event) => { e.preventDefault(); vm.editSamplingRateFilter(); }}>${computeSamplingRateFilterText(vm.filter)}</a>, 
     <a href="#" @click=${(e: Event) => { e.preventDefault(); vm.editSearchFilter(); }}>${computeSearchFilterText(vm.filter)}</a>, 
     and <a href="#" @click=${(e: Event) => { e.preventDefault(); vm.editHeaderFilter(); }}>${computeHeaderFilterText(vm.filter)}</a>.
     ${vm.hasAnyFilters() ? html`(<a href="#" @click=${(e: Event) => { e.preventDefault(); vm.resetFilters(); }}>reset</a>)` : ''}`;
};

function computeEventFilterText(filter: FilterState): string {
    const { event1 } = filter;
    return event1 === 'cron' ? 'CRON trigger events' 
        : event1 === 'http' ? 'HTTP request events' 
        : 'all events';
}

function computeStatusFilterText(filter: FilterState): string {
    const { status1 } = filter;
    return status1 === 'error' ? 'error status' 
        : status1 === 'success' ? 'success status' 
        : 'any status';
}

function computeIpAddressFilterText(filter: FilterState): string {
    const ipAddress1 = filter.ipAddress1 || [];
    return ipAddress1.length === 0 ? 'any IP address'
        : ipAddress1.length === 1 ? `IP address of ${ipAddress1[0]}`
        : `IP address in [${ipAddress1.join(', ')}]`;
}

function computeMethodFilterText(filter: FilterState): string {
    const method1 = filter.method1 || [];
    return method1.length === 0 ? 'any method'
        : method1.length === 1 ? `method of ${method1[0]}`
        : `method in [${method1.join(', ')}]`;
}

function computeSamplingRateFilterText(filter: FilterState): string {
    const samplingRate1 = typeof filter.samplingRate1 === 'number' ? filter.samplingRate1 : 1;
    return samplingRate1 >= 1 ? 'no sampling'
        : `${(Math.max(0, samplingRate1) * 100).toFixed(2)}% sampling rate`;
}

function computeSearchFilterText(filter: FilterState): string {
    const { search1 } = filter;
    return typeof search1 === 'string' && search1.length > 0 ? `console logs containing "${search1}"`
        : 'no search filter';
}

function computeHeaderFilterText(filter: FilterState): string {
    const header1 = filter.header1 || [];
    return header1.length === 0 ? 'no header filter'
        : header1.length === 1 ? `header filter of ${header1[0]}`
        : `header filters of [${header1.join(', ')}]`;
}

function computeTailsText(tailCount: number): string {
    return tailCount === 0 ? 'no tails'
        : tailCount === 1 ? '1 tail'
        : `${tailCount} tails`;
}

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
