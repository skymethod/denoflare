/// <reference lib="dom" />

import { css, html, LitElement } from '../deps_app.ts';
import { FilterState, WebtailAppVM } from '../webtail_app_vm.ts';
import { actionIcon, CLEAR_ICON } from './icons.ts';

export const ANALYTICS_HTML = html`
<div id="analytics">
    <div id="analytics-header">
        header
    </div>
    <div id="analytics-panel"></div>
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
    height: 3.75rem;
    background-color: var(--background-color);
    display: flex;
    padding: 1.25rem 1rem 1rem 0;
}

#analytics-panel {
    display: none;
}

`;

export function initAnalytics(document: HTMLDocument, vm: WebtailAppVM): () => void {
    const analyticsDiv = document.getElementById('analytics') as HTMLDivElement;
    const analyticsHeader = document.getElementById('analytics-header') as HTMLElement;
    const analyticsPanel = document.getElementById('analytics-panel') as HTMLElement;

    return () => {
        analyticsDiv.style.display = vm.selectedAnalyticId ? 'block' : 'none';
        if (vm.selectedAnalyticId === 'do-costs') {
            analyticsHeader.innerText = 'Durable Object Costs';
        }
    };
}

//

