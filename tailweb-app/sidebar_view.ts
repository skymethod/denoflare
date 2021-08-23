import { SidebarItem, TailwebAppVM } from './tailweb_app_vm.ts';

export function updateSidebarView(div: HTMLDivElement, vm: TailwebAppVM) {
    while (div.firstChild) div.removeChild(div.firstChild);
    for (const profile of vm.profiles) {
        div.appendChild(createButton(profile, vm));
    }
    div.appendChild(createNewProfileButton(vm));
}

//

function createButton(profile: SidebarItem, vm: TailwebAppVM): HTMLElement {
    const button = document.createElement('button');
    if (profile.id === vm.selectedProfileId) button.classList.add('selected');
    button.textContent = profile.text;
    button.dataset['id'] = profile.id;
    button.onclick = e => {
        e.preventDefault();
        vm.editProfile(profile.id);
    };
    return button;
}

function createNewProfileButton(vm: TailwebAppVM): HTMLElement {
    const button = document.createElement('button');
    button.textContent = 'New profile...';
    button.onclick = e => {
        e.preventDefault();
        vm.newProfile();
    };
    return button;
}
