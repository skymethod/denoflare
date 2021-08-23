/// <reference lib="dom" />

import { CloudflareApi, createTail } from '../common/cloudflare_api.ts';
import { TailMessage } from '../common/tail.ts';
import { ErrorInfo, TailConnection, TailConnectionCallbacks } from '../common/tail_connection.ts';
import { dumpMessagePretty } from '../common/tail_pretty.ts';
import { TailwebAppVM } from './tailweb_app_vm.ts';

const profileSelect = document.getElementById('profile') as HTMLSelectElement;
const profileEditButton = document.getElementById('profile-edit')!;
const profileNewButton = document.getElementById('profile-new')!;

const profileForm = document.getElementById('profile-form')!;
const profileNameInput = document.getElementById('profile-name') as HTMLInputElement;
const profileAccountIdInput = document.getElementById('profile-account-id') as HTMLInputElement;
const profileApiTokenInput = document.getElementById('profile-api-token') as HTMLInputElement;
const profileDeleteButton = document.getElementById('profile-delete') as HTMLButtonElement;
const profileCancelButton = document.getElementById('profile-cancel') as HTMLButtonElement;
const profileSaveButton = document.getElementById('profile-save') as HTMLButtonElement;

const vm = new TailwebAppVM();
vm.onchange = () => {
    while (profileSelect.firstChild) profileSelect.removeChild(profileSelect.firstChild);
    for (const option of vm.profiles) {
        const optionElement = document.createElement('option');
        optionElement.value = option.id;
        optionElement.textContent = option.text;
        profileSelect.appendChild(optionElement);
    }
    profileSelect.disabled = !vm.profilesEnabled;
    profileEditButton.style.display = vm.profilesEnabled && !vm.profileForm.showing ? 'inline-block' : 'none';
    profileNewButton.style.display = !vm.profileForm.showing ? 'inline-block' : 'none';

    profileForm.style.display = vm.profileForm.showing ? 'grid' : 'none';
    profileNameInput.value = vm.profileForm.name;
    profileAccountIdInput.value = vm.profileForm.accountId;
    profileApiTokenInput.value = vm.profileForm.apiToken;
    profileDeleteButton.style.display = vm.profileForm.deleteVisible ? 'inline-block' : 'none';
    profileSaveButton.disabled = !vm.profileForm.saveEnabled;
};
profileSelect.onchange = () => {
    console.log(profileSelect);
    vm.setCurrentProfileId(profileSelect.selectedOptions[0].value);
}
profileEditButton.onclick = () => {
    vm.editProfile();
    profileAccountIdInput.focus();
}
profileNewButton.onclick = () => {
    vm.newProfile();
    profileAccountIdInput.focus();
}
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
