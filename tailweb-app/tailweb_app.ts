/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { CloudflareApi, createTail } from '../common/cloudflare_api.ts';
import { TailMessage } from '../common/tail.ts';
import { ErrorInfo, TailConnection, TailConnectionCallbacks } from '../common/tail_connection.ts';
import { dumpMessagePretty } from '../common/tail_pretty.ts';
import { updateSidebarView } from './sidebar_view.ts';
import { TailwebAppVM } from './tailweb_app_vm.ts';
import { css, html, LitElement } from './deps_app.ts';
import { MATERIAL_CSS } from './material.ts';

const appCss = css`

header {
    position: sticky;
    display: flex;
    padding: 1rem;
}

main {
    display: flex;
}

#sidebar {
    margin-left: 1rem;
}

.button-grid {
    display: grid;
    grid-template-columns: 1fr 2rem;
    grid-gap: 1px;
    margin-left: 1px;
    margin-top: 1rem;
}

.button-grid-new {
    grid-column: 1;
    min-width: 8rem;
}

#sidebar button {
    grid-column: 1;
}

`;

const appHtml = html`<header class="h6 high-emphasis-text">
<div style="flex-grow: 1;">Denoflare Tail</div>
<div id="message">Saving profile...</div>
</header>
<main>
<div id="sidebar">
</div>
<div id="content">
<form id="profile-form" autocomplete="off">
<fieldset id="profile-fieldset">
  <div id="profile-form-title" class="h6 high-emphasis-text">Profile</div>
  <label for="profile-name">Profile name:</label>
  <input id="profile-name" type="text">

  <label for="account-id">Cloudflare Account ID:</label>
  <input id="profile-account-id" type="text">

  <label for="api-token">Cloudflare API Token:</label>
  <input id="profile-api-token" type="text">

  <div class="form-lhs">
      <button id="profile-delete">Delete</button>
  </div>
  <div class="form-rhs">
      <button id="profile-cancel">Cancel</button>
      <button id="profile-save">Save</button>
  </div>
</fieldset>
</form>
</div>
</main>`;

const styleSheet = document.createElement('style');
styleSheet.type = 'text/css';
styleSheet.textContent = MATERIAL_CSS.cssText + '\n\n' + appCss.cssText;
document.head.appendChild(styleSheet);

LitElement.render(appHtml, document.body);

const sidebarDiv = document.getElementById('sidebar') as HTMLDivElement;
const profileForm = document.getElementById('profile-form') as HTMLFormElement;
const profileFormTitleDiv = document.getElementById('profile-form-title') as HTMLElement;
const profileFieldset = document.getElementById('profile-fieldset') as HTMLFieldSetElement;
const profileNameInput = document.getElementById('profile-name') as HTMLInputElement;
const profileAccountIdInput = document.getElementById('profile-account-id') as HTMLInputElement;
const profileApiTokenInput = document.getElementById('profile-api-token') as HTMLInputElement;
const profileDeleteButton = document.getElementById('profile-delete') as HTMLButtonElement;
const profileCancelButton = document.getElementById('profile-cancel') as HTMLButtonElement;
const profileSaveButton = document.getElementById('profile-save') as HTMLButtonElement;
const messageDiv = document.getElementById('message') as HTMLElement;

const vm = new TailwebAppVM();
vm.onchange = () => {

    updateSidebarView(sidebarDiv, vm);

    profileForm.style.display = vm.profileForm.showing ? 'grid' : 'none';
    profileFieldset.disabled = !vm.profileForm.enabled;
    profileFormTitleDiv.textContent = vm.profileForm.title;
    profileNameInput.value = vm.profileForm.name;
    profileAccountIdInput.value = vm.profileForm.accountId;
    profileApiTokenInput.value = vm.profileForm.apiToken;
    profileDeleteButton.style.display = vm.profileForm.deleteVisible ? 'inline-block' : 'none';
    profileSaveButton.disabled = !vm.profileForm.saveEnabled;
    messageDiv.textContent = vm.message;
};

profileCancelButton.onclick = () => {
    vm.cancelProfile();
}
profileNameInput.oninput = () => {
    vm.setProfileName(profileNameInput.value);
}
profileAccountIdInput.oninput = () => {
    vm.setProfileAccountId(profileAccountIdInput.value);
}
profileApiTokenInput.oninput = () => {
    vm.setProfileApiToken(profileApiTokenInput.value);
}
profileSaveButton.onclick = () => {
    vm.saveProfile();
}
profileDeleteButton.onclick =() => {
    vm.deleteProfile(vm.profileForm.profileId);
}

vm.start();

if (false) {
    const accountId = '';
    const apiToken = '';
    const scriptName = '';
    try {
        CloudflareApi.URL_TRANSFORMER = v => `/fetch/${v.substring('https://'.length)}`;
        const tail = await createTail(accountId, scriptName, apiToken);
        document.body.appendChild(document.createTextNode(JSON.stringify(tail, undefined, 2)));

        // deno-lint-ignore no-explicit-any
        const logger = (...data: any[]) => {
            const div = document.createElement('DIV');
            const msg = data[0];
            const tokens = msg.split('%c');
            for (let i = 0; i < tokens.length; i++) {
                const span = document.createElement('SPAN');
                const style = data[i];
                span.setAttribute('style', style);
                span.textContent = tokens[i];
                div.appendChild(span);
            }
            document.body.appendChild(div);
        };
        const callbacks: TailConnectionCallbacks = {
            onOpen(_cn: TailConnection, timeStamp: number) {
                console.log('open', { timeStamp });
            },
            onClose(_cn: TailConnection, timeStamp: number, code: number, reason: string, wasClean: boolean) {
                console.log('close', { timeStamp, code, reason, wasClean });
            },
            onError(_cn: TailConnection, timeStamp: number, errorInfo?: ErrorInfo) {
                console.log('error', { timeStamp, errorInfo });
            },
            onTailMessage(_cn: TailConnection, timeStamp: number, message: TailMessage) {
                console.log('tailMessage', { timeStamp, message });
                dumpMessagePretty(message, logger);
            },
            // deno-lint-ignore no-explicit-any
            onUnparsedMessage(_cn: TailConnection, timeStamp: number, message: any, parseError: Error) {
                console.log('unparsedMessage', { timeStamp, message, parseError });
            },
        };
        const _cn = new TailConnection(tail.url, callbacks);
        
    } catch (e) {
        document.body.appendChild(document.createTextNode(e.stack));
    }
}
