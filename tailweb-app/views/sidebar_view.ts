import { svg, html, LitElement, SVGTemplateResult, css } from '../deps_app.ts';
import { Material } from '../material.ts';
import { TailwebAppVM } from '../tailweb_app_vm.ts';
import { HEADER_HTML, initHeader } from './header_view.ts';

export const SIDEBAR_HTML = html`
<div id="sidebar">
    ${HEADER_HTML}
    <div id="profiles"></div>
    <div id="scripts"></div>
</div>
`;

export const SIDEBAR_CSS = css`

#sidebar {
    margin-left: 1rem;
    height: 100vh;
    overflow-y: hidden;
    min-width: 15rem;
}

#sidebar .button-grid {
    display: grid;
    grid-template-columns: 1fr 2rem;
    grid-gap: 1px;
    margin-left: 1px;
    margin-top: 1rem;
}

#sidebar .button-grid-new {
    grid-column: 1;
    min-width: 8rem;
}

#sidebar button {
    grid-column: 1;
}

`;

export function initSidebar(document: HTMLDocument, vm: TailwebAppVM): () => void {
    const updateHeader = initHeader(document, vm);

    const profilesDiv = document.getElementById('profiles') as HTMLDivElement;
    const scriptsDiv = document.getElementById('scripts') as HTMLDivElement;
    return () => {
        updateHeader();
        LitElement.render(PROFILES_HTML(vm), profilesDiv);
        LitElement.render(SCRIPTS_HTML(vm), scriptsDiv);
    };
}

//

const PROFILES_HTML = (vm: TailwebAppVM) => html`
    <div class="overline medium-emphasis-text">Profiles</div>
    <div class="button-grid">
    ${vm.profiles.map(profile => html`<button class="${profile.id === vm.selectedProfileId ? 'selected' : ''}" @click=${() => { vm.selectedProfileId = profile.id; }}>${profile.text}</button>
    ${profile.id === vm.selectedProfileId ? html`${actionIcon(editIcon, { onclick: () => vm.editProfile(profile.id) })}` : ''}`)}
    <div class="button-grid-new">${actionIcon(addIcon, { text: 'New', onclick: () => vm.newProfile() })}</div>
    </div>
`;

const SCRIPTS_HTML = (vm: TailwebAppVM) => html`
    <div class="overline medium-emphasis-text">Scripts</div>
    <div class="button-grid">
    ${vm.scripts.map(script => html`<button class="${script.id === vm.selectedScriptId ? 'selected' : ''}" @click=${() => { vm.selectedScriptId = script.id; }}>${script.text}</button>
    `)}
    </div>
`;

function actionIcon(icon: SVGTemplateResult, opts: { text?: string, onclick?: () => void } = {}) {
    const { text, onclick } = opts;
    return html`<div class="action-icon" @click=${(e: Event) => { e.preventDefault(); onclick && onclick(); }}>${icon}${text || ''}</div>`;
}


const editIcon = svg`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="${Material.highEmphasisTextColor}"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg>`;
// const deleteIcon = svg`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="${Material.highEmphasisTextColor}"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>`;
const addIcon = svg`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="${Material.highEmphasisTextColor}">><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
