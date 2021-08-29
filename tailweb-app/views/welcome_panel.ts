/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { css, html } from '../deps_app.ts';
import { TailwebAppVM } from '../tailweb_app_vm.ts';

export const WELCOME_PANEL_HTML = html`
<form id="welcome-panel" autocomplete="off">
<fieldset id="welcome-panel-fieldset">
  <div id="welcome-panel-form-title" class="h6 high-emphasis-text form-row">Hello 👋</div>

  <div class="form-row body2 medium-emphasis-text">
    Welcome to <span class="high-emphasis-text">Denoflare Tail</span>!
    <p>View real-time requests and logs from <a href="https://workers.cloudflare.com/" target="_blank">Cloudflare Workers</a> from the comfort of your browser. 
    A few enhancements over what's provided <a href="https://blog.cloudflare.com/introducing-workers-dashboard-logs/" target="_blank">by default</a> in the Cloudflare dashboard:</p>
    <ul>
        <li>Tail multiple workers at the same time</li>
        <li>Advanced filtering and multi-color output similar to <a href="https://developers.cloudflare.com/workers/cli-wrangler/commands#tail" target="_blank">wrangler tail</a></li>
        <li>Durable object class/name/id and colo information can be surfaced with <a href="TODO" target="_blank">logprops</a></li>
        <li>Multiple profiles, switch easily between multiple accounts</li>
        <li>No need to log in with your full Cloudflare credentials.  Profiles are stored locally in the browser, and can be permissioned only for tailing workers</li>
        <li>Implemented as a standard open source Cloudflare Worker, <a href="TODO" target="_blank">deploy it to your own account</a>, 
            or <a href="TODO" target="_blank">host it locally</a> with <a href="https://github.com/skymethod/denoflare" target="_blank"><code>denoflare</code></a></li>
    </ul>
    <p>Create a new profile to get started!</p>
  </div>

  <div class="form-rhs">
    <button id="welcome-panel-new-profile" type="submit">New profile</button>
  </div>
</fieldset>
</form>
`;

export const WELCOME_PANEL_CSS = css`

    #welcome-panel-form-title {
        user-select: none; -webkit-user-select: none;
    }

`;

export function initWelcomePanel(document: HTMLDocument, vm: TailwebAppVM): () => void {
    const welcomePanelElement = document.getElementById('welcome-panel') as HTMLElement;
    const newProfileButton = document.getElementById('welcome-panel-new-profile') as HTMLButtonElement;

    newProfileButton.onclick = e => {
        e.preventDefault();
        vm.newProfile();
    }

    return () => {
        const wasHidden = welcomePanelElement.style.display === 'none';
        const show = vm.welcomeShowing && !vm.profileForm.showing;
        welcomePanelElement.style.display = show ? 'block' : 'none';

        if (wasHidden && show) {
            console.log('welcome panel open');

            setTimeout(() => { 
                newProfileButton.focus();
            }, 0); 
        }
    };    
}
