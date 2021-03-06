/// <reference lib="dom" />

import { css, html } from '../deps_app.ts';
import { WebtailAppVM } from '../webtail_app_vm.ts';
import { FILTER_EDITOR_HTML, initFilterEditor } from './filter_editor_view.ts';
import { initProfileEditor, PROFILE_EDITOR_HTML } from './profile_editor_view.ts';
import { initWelcomePanel, WELCOME_PANEL_HTML } from './welcome_panel.ts';

export const MODAL_HTML = html`
<div id="modal" class="modal hidden-vertical-scroll">
    <div class="modal-content">
    ${WELCOME_PANEL_HTML}
    ${PROFILE_EDITOR_HTML}
    ${FILTER_EDITOR_HTML}
    </div>
</div>
`;

export const MODAL_CSS = css`
.modal {
    display: none;
    position: fixed;
    z-index: 1;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.4);
}

.modal-content {
    margin: 10% auto;
    width: 80%;
    max-width: 40rem;
    background-color: var(--background-color);
}

@media screen and (max-width: 600px) {
    .modal-content {
        margin: 10% 0;
        width: 100%;
    }
}

`;

export function initModal(document: HTMLDocument, vm: WebtailAppVM): () => void {

    const modal = document.getElementById('modal') as HTMLDivElement;
    const updateProfileEditor = initProfileEditor(document, vm);
    const updateFilterEditor = initFilterEditor(document, vm);
    const updateWelcomePanel = initWelcomePanel(document, vm);

    const closeModal = () => {
        if (!vm.profileForm.showing && !vm.filterForm.showing && !vm.welcomeShowing && !vm.aboutShowing) return;
        if (vm.profileForm.progressVisible) return; // don't allow close if busy
        vm.profileForm.showing = false;
        vm.filterForm.showing = false;
        vm.aboutShowing = false;
        vm.onChange();
    };

    // Click outside modal content -> close modal
    window.addEventListener('click', event => {
        if (event.target == modal) {
            closeModal();
        }
    });

    // esc -> close modal
    document.addEventListener('keydown', event => {
        event = event || window.event;
        if (event.key === 'Escape') {
            closeModal();
        }
    });

    return () => {
        updateProfileEditor();
        updateFilterEditor();
        updateWelcomePanel();
        modal.style.display = (vm.profileForm.showing || vm.filterForm.showing || vm.welcomeShowing || vm.aboutShowing) ? 'block' : 'none';
    };
}
