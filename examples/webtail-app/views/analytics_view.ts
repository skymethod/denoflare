/// <reference lib="dom" />

import { css, html, LitElement, DurableObjectsCostsTable, DurableObjectsDailyCostsTable } from '../deps_app.ts';
import { WebtailAppVM } from '../webtail_app_vm.ts';

export const ANALYTICS_HTML = html`
<div id="analytics">
    <div id="analytics-header">
        <div id="analytics-heading" class="h6 high-emphasis-text"></div>
        <div id="analytics-subheading" class="medium-emphasis-text"></div>
    </div>
    <div id="analytics-querying"><progress id="analytics-progress" class="pure-material-progress-circular"></progress><div class="medium-emphasis-text">Fetching analytics...</div></div>
    <div id="analytics-error" class="medium-emphasis-text"></div>
    <div id="analytics-table" class="medium-emphasis-text"></div>
    <div id="analytics-namespaces-table"  class="medium-emphasis-text"></div>
    <div id="analytics-footnote" class="medium-emphasis-text"><sup>*</sup> Estimated based on recent usage</div>
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

#analytics-querying {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

#analytics table {
    text-align: right;
    border-spacing: 0.375rem;
    font-size: 0.75rem;
    white-space: nowrap;
}

#analytics th {
    text-align: center;
}

#analytics .spacer {
    width: 0.75rem;
}

#analytics-table .estimate td {
    padding-top: 1rem;
}

#analytics .mono {
    font-family: var(--monospace-font-family);
}

#analytics-namespaces-table {
    margin-top: 2rem;
}

#analytics-namespaces-table a.unselected {
    color: var(--medium-emphasis-text-color);
}

@media (hover: hover) {
    #analytics-namespaces-table a.unselected:hover {
        color: var(--primary-color);
    }
}

#analytics .left-aligned {
    text-align: left;
}

#analytics-footnote {
    margin-top: 1rem;
    font-size: 0.75rem;
    display: none;
}

`;

export function initAnalytics(document: HTMLDocument, vm: WebtailAppVM): () => void {
    const analyticsDiv = document.getElementById('analytics') as HTMLDivElement;
    const analyticsHeading = document.getElementById('analytics-heading') as HTMLElement;
    const analyticsSubheading = document.getElementById('analytics-subheading') as HTMLElement;
    const analyticsQueryingElement = document.getElementById('analytics-querying') as HTMLElement;
    const analyticsErrorElement = document.getElementById('analytics-error') as HTMLElement;
    const analyticsTableElement = document.getElementById('analytics-table') as HTMLElement;
    const analyticsNamespacesTableElement = document.getElementById('analytics-namespaces-table') as HTMLElement;
    const analyticsFootnoteElement = document.getElementById('analytics-footnote') as HTMLElement;

    return () => {
        analyticsDiv.style.display = vm.selectedAnalyticId ? 'block' : 'none';
        if (!vm.selectedAnalyticId) return;
        const selectedAnalytic = vm.analytics.find(v => v.id === vm.selectedAnalyticId);
        if (!selectedAnalytic) return;
        analyticsHeading.textContent = selectedAnalytic.text;
        analyticsSubheading.textContent = selectedAnalytic.description || '';
        const { durableObjectsCosts, querying, error } = vm.analyticsState;

        analyticsQueryingElement.style.display = querying ? 'flex' : 'none';
        analyticsErrorElement.textContent = error || '';
        analyticsFootnoteElement.style.display = durableObjectsCosts ? 'block' : 'none';
        if (durableObjectsCosts) {
            const renderCosts = (namespaceId: string | undefined) => {
                const table = durableObjectsCosts.namespaceTables[namespaceId || ''] || durableObjectsCosts.accountTable;
                LitElement.render(COSTS_HTML(table, namespaceId), analyticsTableElement);
            }
            renderCosts(undefined);
            LitElement.render(NAMESPACES_HTML(durableObjectsCosts, renderCosts), analyticsNamespacesTableElement);
        } else {
            LitElement.render(undefined, analyticsTableElement);
            LitElement.render(undefined, analyticsNamespacesTableElement);
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

function clickNamespace(e: Event, renderCosts: (namespaceId: string | undefined) => void) {
    e.preventDefault();
    const text = (e.target as HTMLElement).textContent || '';

    console.log('clickNamespace', text);
    renderCosts(text.startsWith('All') ? undefined : text);
    const anchors = document.querySelectorAll('#analytics-namespaces-table a');
    anchors.forEach(a => {
        a.className = a === e.target ? '' : 'unselected';
    });
}

const NAMESPACES_HTML = (table: DurableObjectsCostsTable, renderCosts: (namespaceId: string | undefined) => void) => html`
    <table>
        <tr>
            <th>Namespace ID</th><th class="spacer"></th>
            <th>Script</th>
            <th>Class</th><th class="spacer"></th>
            <th>Total</th>
        </tr>
        <tr>
            <td class="left-aligned mono"><a href="#" @click=${(e: Event) => clickNamespace(e, renderCosts)}>All durable objects</a></td><td></td>
            <td></td>
            <td></td><td></td>
            <td>$${(table.accountTable.estimated30DayRow?.totalCost || 0).toFixed(2)}</td>
        </tr>
    ${[...Object.entries(table.namespaceTables)].sort((a, b) => (b[1].estimated30DayRow?.totalCost || 0) - (a[1].estimated30DayRow?.totalCost || 0)).map(v => {
        const [namespaceId, t] = v;
        return html`<tr>
            <td class="left-aligned mono"><a href="#" @click=${(e: Event) => clickNamespace(e, renderCosts)} class="unselected">${namespaceId}</a></td><td></td>
            <td class="left-aligned">${t.namespace?.script || ''}</td>
            <td class="left-aligned">${t.namespace?.class || ''}</td><td></td>
            <td>$${(t.estimated30DayRow?.totalCost || 0).toFixed(2)}</td>
            </tr>`;
    })}
    </table>
`;

const COSTS_HTML = (table: DurableObjectsDailyCostsTable, _namespaceId: string | undefined) => html`
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
            <td class="high-emphasis-text">${v.storageGb === undefined ? '?' : formatGb(v.storageGb) }</td>
            <td>${v.storageCost === undefined ? '' : `$${format2(v.storageCost)}`}</td><td></td>
            <td>$${format2(v.totalCost)}</td>
        </tr>`)}

        ${table.estimated30DayRow ? html`<tr class="estimate">
            <td>30-day bill<sup>*</sup></td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.requestsCost)}</td><td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.websocketsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.subrequestsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.activeCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.readUnitsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.writeUnitsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.deletesCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRow.storageCost || 0)}</td><td></td>
            <td>$${format2(table.estimated30DayRow.totalCost)}</td>
        </tr>` : ''}
        ${table.estimated30DayRowMinusFree ? html`<tr>
            <td>− free usage</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.requestsCost)}</td><td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.websocketsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.subrequestsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.activeCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.readUnitsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.writeUnitsCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.deletesCost)}</td><td></td>
            <td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.storageCost || 0)}</td><td></td>
            <td>$${format2(table.estimated30DayRowMinusFree.totalCost)}</td>
        </tr>` : ''}
    </table>
`;
