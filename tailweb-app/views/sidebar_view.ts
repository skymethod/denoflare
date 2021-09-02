/// <reference lib="dom" />

import { setSubtract, setUnion } from '../../common/sets.ts';
import { html, LitElement, css } from '../deps_app.ts';
import { StaticData } from '../static_data.ts';
import { TailwebAppVM } from '../tailweb_app_vm.ts';
import { HEADER_HTML, initHeader } from './header_view.ts';
import { actionIcon, ADD_ICON, EDIT_ICON } from './icons.ts';

export const SIDEBAR_HTML = html`
<div id="sidebar">
    ${HEADER_HTML}
    <a id="sidebar-about" class="overline medium-emphasis-text" href="#">About</a>
    <div id="profiles"></div>
    <div id="scripts"></div>
</div>
`;

export const SIDEBAR_CSS = css`

#sidebar {
    margin-left: 1rem;
    height: 100vh;
    min-width: 15rem;
}

#sidebar-about {
    display: block;
    margin-bottom: 1rem;
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

#sidebar .button-grid .hint {
    grid-column: 1; 
    text-align: center;
}

#scripts-scroller {
    height: calc(100vh - 18rem);
}

`;

export function initSidebar(document: HTMLDocument, vm: TailwebAppVM, data: StaticData): () => void {
    const updateHeader = initHeader(document, vm, data);
    const aboutAnchor = document.getElementById('sidebar-about') as HTMLAnchorElement;
    const profilesDiv = document.getElementById('profiles') as HTMLDivElement;
    const scriptsDiv = document.getElementById('scripts') as HTMLDivElement;

    aboutAnchor.onclick = e => {
        e.preventDefault();
        vm.showAbout();
    };
    
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
        ${vm.profiles.map(profile => html`<button 
            class="${ profile.id === vm.selectedProfileId ? 'selected' : ''}" 
            @click=${() => { vm.selectedProfileId = profile.id; }}
            ?disabled="${vm.profileForm.showing}">${profile.text}</button>
        ${profile.id === vm.selectedProfileId ? html`${actionIcon(EDIT_ICON, { onclick: () => vm.editProfile(profile.id) })}` : ''}`)}
        <div class="button-grid-new">${actionIcon(ADD_ICON, { text: 'New', onclick: () => vm.newProfile() })}</div>
    </div>
`;

const SCRIPTS_HTML = (vm: TailwebAppVM) => html`
    <div class="overline medium-emphasis-text">Scripts</div>
    <div id="scripts-scroller" class="hidden-vertical-scroll">
        <div class="button-grid">
            ${vm.scripts.map(script => 
                html`<button
                    class="${vm.selectedScriptIds.has(script.id) ? 'selected' : ''}" 
                    @click=${(e: MouseEvent) => handleScriptClick(e, script.id, vm)} 
                    ?disabled="${vm.profileForm.showing}">${script.text}</button>
            `)}
        </div>
    </div>
    <div class="button-grid">
        <div class="caption medium-emphasis-text hint">${computeMultiselectKeyChar()}-click to multiselect</div>
    </div>
`;

function computeMultiselectKeyChar() {
    return isMacintosh() ? '⌘' : 'ctrl';
}

function isMacintosh() {
    return navigator.platform.indexOf('Mac') > -1;
}

function handleScriptClick(e: MouseEvent, scriptId: string, vm: TailwebAppVM) {
    e.preventDefault();
    const newScriptIds = new Set([scriptId]);
    const multi = isMacintosh() ? e.metaKey : e.ctrlKey;
    vm.selectedScriptIds = multi
        ? (vm.selectedScriptIds.has(scriptId) ? setSubtract(vm.selectedScriptIds, newScriptIds) : setUnion(vm.selectedScriptIds, newScriptIds))
        : newScriptIds;
}
