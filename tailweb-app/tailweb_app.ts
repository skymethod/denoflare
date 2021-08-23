/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { CloudflareApi, createTail } from '../common/cloudflare_api.ts';
import { TailMessage } from '../common/tail.ts';
import { ErrorInfo, TailConnection, TailConnectionCallbacks } from '../common/tail_connection.ts';
import { dumpMessagePretty } from '../common/tail_pretty.ts';
import { updateSidebarView } from './sidebar_view.ts';
import { TailwebAppVM } from './tailweb_app_vm.ts';
import { css, html } from 'https://cdn.skypack.dev/lit-element';

const appCss = css`
header {
    position: sticky;
    display: flex;
}

fieldset {
    display: grid;
}

label, .form-lhs {
    grid-column: 1;
}

input, .form-rhs {
    grid-column: 2;
}

header {
    padding: 1rem;
}

main {
    display: flex;
}

#sidebar {
    display: flex;
    flex-direction: column;
}

button {
    border: solid 1px white;
    padding: 0.5rem 1rem;
    text-align: center;
    text-decoration: none;
    color:  rgba(255,255,255,0.9);
    cursor: pointer;
    user-select: none;
    background: inherit;
    min-width: 8rem;
}

button:hover {
    background: rgba(255,255,255,0.5);
    color: #fff;
}

button.selected {
    background: blue;
}

button:disabled {
    border-color: rgba(255,255,255,0.5);
    color:  rgba(255,255,255,0.5);
}

button:disabled:hover {
    background: inherit;
    cursor: default;
}
`;

const appHtml = html`<header>
<div style="flex-grow: 1;">Denoflare Tail</div>
<div id="message">Saving profile...</div>
</header>
<main>
<div id="sidebar">
</div>
<div id="content">
<form id="profile-form" autocomplete="off">
<fieldset id="profile-fieldset">
  <h3>Profile</h3>
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
styleSheet.innerText = appCss.cssText;
document.head.appendChild(styleSheet);

document.body.innerHTML = appHtml.getHTML();

const sidebarDiv = document.getElementById('sidebar') as HTMLDivElement;

const profileForm = document.getElementById('profile-form') as HTMLFormElement;
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
    vm.deleteProfile();
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
