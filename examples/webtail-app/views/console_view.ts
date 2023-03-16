/// <reference lib="dom" />

import { css, html, LitElement, render } from '../deps_app.ts';
import { FilterState, WebtailAppVM } from '../webtail_app_vm.ts';
import { actionIcon, CLEAR_ICON } from './icons.ts';

export const CONSOLE_HTML = html`
<div id="console">
    <div id="console-header">
        <div id="console-header-filters" class="body2"></div>
        <div id="console-header-status">
            <div id="console-header-tails" class="overline medium-emphasis-text"></div>
            <div id="console-header-qps" class="overline medium-emphasis-text"></div>
            <div id="console-header-clear"></div>
        </div>
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
    height: 3.75rem;
    background-color: var(--background-color);
    display: flex;
    padding: 1.25rem 1rem 1rem 0;
}

#console-header-filters {
    flex-grow: 1;
    color: var(--medium-emphasis-text-color);
    font-family: var(--sans-serif-font-family);

    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;  
    overflow: hidden;
}

#console-header-status {
    height: 1rem;
    display: flex;
    flex-direction: column;
    min-width: 6rem;
    text-align: right;
    padding-top: 0.25rem;
    user-select: none; -webkit-user-select: none;
}

#console-header-tails {
    white-space: nowrap;
}

#console-header-clear {
    margin-right: -0.5rem;
    margin-left: 1rem;
    visibility: hidden;
}

#console-header-clear .action-icon {
    padding-right: 0.5rem;
    padding-left: 0.5rem;
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

export function initConsole(document: HTMLDocument, vm: WebtailAppVM): () => void {
    const consoleDiv = document.getElementById('console') as HTMLDivElement;
    const consoleHeaderFiltersDiv = document.getElementById('console-header-filters') as HTMLDivElement;
    const consoleHeaderTailsElement = document.getElementById('console-header-tails') as HTMLElement;
    const consoleHeaderQpsElement = document.getElementById('console-header-qps') as HTMLElement;
    const consoleHeaderClearElement = document.getElementById('console-header-clear') as HTMLElement;
    const consoleLastLineElement = document.getElementById('console-last-line') as HTMLElement;

    let showingClearButton = false;

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
                    let rendered = false;
                    if (i > 0 && i < tokens.length - 1) {
                        const style = data[pos + i];
                        span.setAttribute('style', style);

                        // set special do filter links if applicable
                        if (typeof style === 'string') {
                            if (style.includes('x-')) {
                                const m = /x-durable-object-(class|name|id)\s*:\s*'(.*?)'/.exec(style);
                                if (m) {
                                    const type = m[1];
                                    const value = m[2];
                                    const logpropName = 'durableObject' + type.substring(0, 1).toUpperCase() + type.substring(1);
                                    const a = document.createElement('a');
                                    a.href = '#';
                                    a.onclick = () => {
                                        vm.setLogpropFilter([ logpropName + ':' + value ]);
                                        vm.onChange();
                                    };
                                    a.appendChild(document.createTextNode(tokens[i]));
                                    span.appendChild(a);
                                    rendered = true;
                                }
                            }
                        }
                    }
                    if (!rendered) renderTextIntoSpan(tokens[i], span);
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
        if (!showingClearButton) {
            consoleHeaderClearElement.style.visibility = 'visible';
            showingClearButton = true;
        }
    };
    vm.onResetOutput = () => {
        const lines = consoleDiv.querySelectorAll('.line');
        lines.forEach(line => {
            if (line.id !== 'console-last-line') consoleDiv.removeChild(line);
        });
        consoleHeaderClearElement.style.visibility = 'hidden';
        showingClearButton = false;
    };
    consoleHeaderQpsElement.textContent = computeQpsText(0);
    vm.onQpsChange = qps => {
        consoleHeaderQpsElement.textContent = computeQpsText(qps);
    };
    render(actionIcon(CLEAR_ICON, { text: 'Clear', onclick: () => vm.resetOutput() }), consoleHeaderClearElement);

    // for (let i = 0; i < 100; i++) vm.logger(`line ${i}`); // generate a bunch of lines to test scrolling
    // setInterval(() => { vm.logger(`line ${new Date().toISOString()}`); }, 1000); // generate a line every second to test autoscroll

    return () => {
        consoleDiv.style.display = vm.selectedAnalyticId ? 'none' : 'block';
        consoleHeaderFiltersDiv.style.visibility = vm.profiles.length > 0 ? 'visible' : 'hidden';
        consoleHeaderTailsElement.textContent = computeTailsText(vm.tails.size);
        render(FILTERS_HTML(vm), consoleHeaderFiltersDiv);
    };
}

//

const FILTERS_HTML = (vm: WebtailAppVM) => {
    return html`Showing <a href="#" @click=${(e: Event) => { e.preventDefault(); vm.editSelectionFields(); }}>${vm.computeSelectionFieldsText()}</a>
     for <a href="#" @click=${(e: Event) => { e.preventDefault(); vm.editEventFilter(); }}>${computeEventFilterText(vm.filter)}</a>
     with <a href="#" @click=${(e: Event) => { e.preventDefault(); vm.editStatusFilter(); }}>${computeStatusFilterText(vm.filter)}</a>,
     <a href="#" @click=${(e: Event) => { e.preventDefault(); vm.editIpAddressFilter(); }}>${computeIpAddressFilterText(vm.filter)}</a>,
     <a href="#" @click=${(e: Event) => { e.preventDefault(); vm.editMethodFilter(); }}>${computeMethodFilterText(vm.filter)}</a>,
     <a href="#" @click=${(e: Event) => { e.preventDefault(); vm.editSamplingRateFilter(); }}>${computeSamplingRateFilterText(vm.filter)}</a>, 
     <a href="#" @click=${(e: Event) => { e.preventDefault(); vm.editSearchFilter(); }}>${computeSearchFilterText(vm.filter)}</a>, 
    <a href="#" @click=${(e: Event) => { e.preventDefault(); vm.editHeaderFilter(); }}>${computeHeaderFilterText(vm.filter)}</a>,
     and <a href="#" @click=${(e: Event) => { e.preventDefault(); vm.editLogpropFilter(); }}>${computeLogpropFilterText(vm.filter)}</a>.
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

function computeLogpropFilterText(filter: FilterState): string {
    const logprop1 = filter.logprop1 || [];
    return logprop1.length === 0 ? 'no logprop filter'
        : logprop1.length === 1 ? `logprop filter of ${logprop1[0]}`
        : `logprop filters of [${logprop1.join(', ')}]`;
}

function computeTailsText(tailCount: number): string {
    return tailCount === 0 ? 'no tails'
        : tailCount === 1 ? '1 tail'
        : `${tailCount} tails`;
}

function computeQpsText(qps: number): string {
    return `${qps.toFixed(2)} qps`;
}

function renderTextIntoSpan(text: string, span: HTMLSpanElement) {
    const pattern = /(https:\/\/[^\s)]+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|[\d0-f]+(:([\d0-f]{0,4})?){5,7})/g;
    let m: RegExpExecArray | null;
    let i = 0;
    while(null !== (m = pattern.exec(text))) {
        if (m.index > i) {
            span.appendChild(document.createTextNode(text.substring(i, m.index)));
        }
        const urlOrIp = m[0];
        const a = document.createElement('a');
        a.href = urlOrIp.startsWith('https://') ? urlOrIp : `https://ipinfo.io/${urlOrIp}`;
        a.target = '_blank';
        a.rel = 'noreferrer noopener nofollow';
        a.appendChild(document.createTextNode(urlOrIp));
        span.appendChild(a);
        i = m.index + urlOrIp.length;
    }
    if (i < text.length) {
        span.appendChild(document.createTextNode(text.substring(i)));
    }
}
