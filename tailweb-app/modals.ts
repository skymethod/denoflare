import { html } from './deps_app.ts';
import { TailwebAppVM } from './tailweb_app_vm.ts';

const profilesForm = html`
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
`;

export const MODALS_HTML = html`
<div id="modal" class="modal">
    <div class="modal-content">
    ${profilesForm}
    </div>
</div>
`;

export function initModals(document: HTMLDocument, vm: TailwebAppVM): () => void {
    const profileForm = document.getElementById('profile-form') as HTMLFormElement;
    const profileFormTitleDiv = document.getElementById('profile-form-title') as HTMLElement;
    const profileFieldset = document.getElementById('profile-fieldset') as HTMLFieldSetElement;
    const profileNameInput = document.getElementById('profile-name') as HTMLInputElement;
    const profileAccountIdInput = document.getElementById('profile-account-id') as HTMLInputElement;
    const profileApiTokenInput = document.getElementById('profile-api-token') as HTMLInputElement;
    const profileDeleteButton = document.getElementById('profile-delete') as HTMLButtonElement;
    const profileCancelButton = document.getElementById('profile-cancel') as HTMLButtonElement;
    const profileSaveButton = document.getElementById('profile-save') as HTMLButtonElement;

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

    return () => {
        profileForm.style.display = vm.profileForm.showing ? 'grid' : 'none';
        profileFieldset.disabled = !vm.profileForm.enabled;
        profileFormTitleDiv.textContent = vm.profileForm.title;
        profileNameInput.value = vm.profileForm.name;
        profileAccountIdInput.value = vm.profileForm.accountId;
        profileApiTokenInput.value = vm.profileForm.apiToken;
        profileDeleteButton.style.display = vm.profileForm.deleteVisible ? 'inline-block' : 'none';
        profileSaveButton.disabled = !vm.profileForm.saveEnabled;
    };    
}
