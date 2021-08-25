import { css, html } from '../deps_app.ts';
import { TailwebAppVM } from '../tailweb_app_vm.ts';

export const HEADER_HTML = html`
<header class="h6 high-emphasis-text">
    <div style="flex-grow: 1;">Denoflare Tail</div>
</header>
`;

export const HEADER_CSS = css`
header {
    display: flex;
    padding: 1rem 0;
}
`;

export function initHeader(_document: HTMLDocument, _vm: TailwebAppVM): () => void {

    return () => {
    }
}
