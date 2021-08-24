import { css, html } from '../deps_app.ts';
import { TailwebAppVM } from '../tailweb_app_vm.ts';

export const HEADER_HTML = html`
<header class="h6 high-emphasis-text">
    <div style="flex-grow: 1;">Denoflare Tail</div>
    <div id="message">Saving profile...</div>
</header>
`;

export const HEADER_CSS = css`
header {
    position: sticky;
    display: flex;
    padding: 1rem;
}
`;

export function initHeader(document: HTMLDocument, vm: TailwebAppVM): () => void {
    const messageDiv = document.getElementById('message') as HTMLElement;

    return () => {
        messageDiv.textContent = vm.message;
    }
}
