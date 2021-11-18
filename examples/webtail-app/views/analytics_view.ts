/// <reference lib="dom" />

import { DurableObjectsCostsTable } from '../../../common/analytics/durable_objects_costs.ts';
import { css, html, LitElement } from '../deps_app.ts';
import { WebtailAppVM } from '../webtail_app_vm.ts';

export const ANALYTICS_HTML = html`
<div id="analytics">
    <div id="analytics-header">
        <div id="analytics-heading" class="h6 high-emphasis-text"></div>
        <div id="analytics-subheading" class="medium-emphasis-text"></div>
    </div>
    <div id="analytics-querying"><progress id="analytics-progress" class="pure-material-progress-circular"></progress> Fetching analytics...</div>
    <div id="analytics-error"></div>
    <div id="analytics-table" class="medium-emphasis-text"></div>
</div>
`;

export const ANALYTICS_CSS = css`

#analytics {
    color: var(--high-emphasis-text-color);
    height: 100vh;
    width: 100%;
    background-color: var(--background-color);
    overflow-y: scroll;
    overflow-x: hidden;
    flex-grow: 1;
    display: none;
}

#analytics::-webkit-scrollbar {
    width: 1rem;
    height: 3rem;
    background-color: var(--background-color);
}

#analytics::-webkit-scrollbar-thumb {
    background-color: var(--medium-emphasis-text-color);
}

#analytics-header {
    position: sticky;
    top: 0;
    background-color: var(--background-color);
    padding: 1rem 0;
    height: 3rem;
}

#analytics-subheading {
    padding: 0.5rem 0;
}

#analytics-progress {
    font-size: 0.5rem; /* default 3em => 1.5rem */
}

#analytics-table table {
    text-align: right;
    border-spacing: 0.375rem;
    font-size: 0.75rem;
    white-space: nowrap;
}

#analytics-table th {
    text-align: center;
}

#analytics-table .spacer {
    width: 0.75rem;
}

`;

export function initAnalytics(document: HTMLDocument, vm: WebtailAppVM): () => void {
    const analyticsDiv = document.getElementById('analytics') as HTMLDivElement;
    const analyticsHeading = document.getElementById('analytics-heading') as HTMLElement;
    const analyticsSubheading = document.getElementById('analytics-subheading') as HTMLElement;
    const analyticsQueryingElement = document.getElementById('analytics-querying') as HTMLElement;
    const analyticsErrorElement = document.getElementById('analytics-error') as HTMLElement;
    const analyticsTableElement = document.getElementById('analytics-table') as HTMLElement;

    return () => {
        analyticsDiv.style.display = vm.selectedAnalyticId ? 'block' : 'none';
        if (!vm.selectedAnalyticId) return;
        const selectedAnalytic = vm.analytics.find(v => v.id === vm.selectedAnalyticId);
        if (!selectedAnalytic) return;
        analyticsHeading.textContent = selectedAnalytic.text;
        analyticsSubheading.textContent = selectedAnalytic.description || '';
        const { durableObjectsCosts, querying, error } = vm.analyticsState;

        analyticsQueryingElement.style.visibility = querying ? 'visible' : 'hidden';
        analyticsErrorElement.textContent = error || '';
        if (durableObjectsCosts) {
            LitElement.render(COSTS_HTML(durableObjectsCosts), analyticsTableElement);
        }
    };
}

//

const FIXED_1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const FIXED_2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

function format1(val: number): string {
    if (val < 1000) return val.toString();
    return `${FIXED_1.format(val / 1000)}k`;
}

function format2(val: number): string {
    if (val < 1000) return val.toFixed(2);
    return `${FIXED_2.format(val / 1000)}k`;
}

function formatGb(val: number): string {
    if (val < 1) return `${format2(val * 1024)}mb`;
    return `${format2(val)}gb`;
}

const COSTS_HTML = (table: DurableObjectsCostsTable) => html`
    <table>
        <tr>
            <th>UTC Day</th><th class="spacer"></th>
            <th colspan="2">Requests</th><th class="spacer"></th>
            <th colspan="4">Websockets</th><th class="spacer"></th>
            <th colspan="2">Subrequests</th><th class="spacer"></th>
            <th colspan="2">Duration</th><th class="spacer"></th>
            <th colspan="2">Reads</th><th class="spacer"></th>
            <th colspan="2">Writes</th><th class="spacer"></th>
            <th colspan="2">Deletes</th><th class="spacer"></th>
            <th colspan="2">Storage</th><th class="spacer"></th>
            <th>Total</th>
        </tr>
        <tr>
            <th></th><th></th>
            <th colspan="2"></th><th></th>
            <th>Max</th>
            <th>In</th>
            <th>Out</th>
            <th></th><th></th>
            <th colspan="2"></th><th></th>
            <th>GB-sec</th>
            <th></th><th></th>
            <th colspan="2"></th><th></th>
            <th colspan="2"></th><th></th>
            <th colspan="2"></th><th></th>
            <th colspan="2"></th><th></th>
            <th></th>
        </tr>
        ${table.rows.map(v => html`<tr>
            <td>${v.date}</td><td></td>
            <td class="high-emphasis-text">${format1(v.sumRequests)}</td>
            <td>$${format2(v.requestsCost)}</td><td></td>
            <td class="high-emphasis-text">${format1(v.maxActiveWebsocketConnections)}</td>
            <td class="high-emphasis-text">${format1(v.sumInboundWebsocketMsgCount)}</td>
            <td class="high-emphasis-text">${format1(v.sumOutboundWebsocketMsgCount)}</td>
            <td>$${format2(v.websocketsCost)}</td><td></td>
            <td class="high-emphasis-text">${format1(v.sumSubrequests)}</td>
            <td>$${format2(v.subrequestsCost)}</td><td></td>
            <td class="high-emphasis-text">${format2(v.activeGbSeconds)}</td>
            <td>$${format2(v.activeCost)}</td><td></td>
            <td class="high-emphasis-text">${format1(v.sumStorageReadUnits)}</td>
            <td>$${format2(v.readUnitsCost)}</td><td></td>
            <td class="high-emphasis-text">${format1(v.sumStorageWriteUnits)}</td>
            <td>$${format2(v.writeUnitsCost)}</td><td></td>
            <td class="high-emphasis-text">${format1(v.sumStorageDeletes)}</td>
            <td>$${format2(v.deletesCost)}</td><td></td>
            <td class="high-emphasis-text">${formatGb(v.storageGb)}</td>
            <td>$${format2(v.storageCost)}</td><td></td>
            <td>$${format2(v.totalCost)}</td>
        </tr>`)}
        <tr>
            <td></td><td></td>
            <td></td>
            <td>$${format2(table.totalRow.requestsCost)}</td><td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>$${format2(table.totalRow.websocketsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.totalRow.subrequestsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.totalRow.activeCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.totalRow.readUnitsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.totalRow.writeUnitsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.totalRow.deletesCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.totalRow.storageCost)}</td><td></td>
            <td>$${format2(table.totalRow.totalCost)}</td>
        </tr>
    </table>
`;
