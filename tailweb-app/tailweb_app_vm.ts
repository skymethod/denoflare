import { generateUuid } from '../common/uuid_v4.ts';

export class TailwebAppVM {
    
    profiles: Option[] = [];
    profilesEnabled = false;
    profileForm = new ProfileFormVM();

    private currentProfileId: string | undefined;
    private readonly state = loadState();

    onchange: () => void = () => {};

    constructor() {

    }

    start() {
        this.reloadProfiles();
        this.onchange();
    }

    newProfile() {
        this.currentProfileId = generateUuid();
        this.profileForm.showing = true;
        this.profileForm.name = 'default';
        this.profileForm.accountId = '';
        this.profileForm.apiToken = '';
        this.onchange();
    }

    cancelProfile() {
        this.profileForm.showing = false;
        this.onchange();
    }

    setCurrentProfileId(profileId: string) {
        this.currentProfileId = profileId;
        this.onchange();
    }

    setProfileName(name: string) {
        this.profileForm.name = name;
        this.profileForm.computeSaveEnabled();
        this.onchange();
    }

    setProfileAccountId(accountId: string) {
        this.profileForm.accountId = accountId;
        this.profileForm.computeSaveEnabled();
        this.onchange();
    }

    setProfileApiToken(apiToken: string) {
        this.profileForm.apiToken = apiToken;
        this.profileForm.computeSaveEnabled();
        this.onchange();
    }

    saveProfile() {
        if (!this.currentProfileId) return;
        this.state.profiles[this.currentProfileId] = {
            name: this.profileForm.name.trim(), 
            accountId: this.profileForm.accountId.trim(), 
            apiToken: this.profileForm.apiToken.trim(),
        };
        saveState(this.state);
        this.profileForm.showing = false;
        this.reloadProfiles();
        this.onchange();
    }

    editProfile() {
        if (!this.currentProfileId) return;
        const { name, accountId, apiToken } = this.state.profiles[this.currentProfileId];

        this.profileForm.showing = true;
        this.profileForm.name = name;
        this.profileForm.accountId = accountId;
        this.profileForm.apiToken = apiToken;
        this.profileForm.computeSaveEnabled();
        this.onchange();
    }

    //

    private reloadProfiles() {
        const { state } = this;

        this.profilesEnabled = Object.keys(state.profiles).length > 0;
        this.profiles.splice(0);

        for (const [profileId, profile] of Object.entries(state.profiles)) {
            const name = profile.name || '(unnamed)';
            this.profiles.push({ id: profileId, text: name });
        }
        if (!this.profilesEnabled) {
            this.profiles.push({ id: 'none', text: '(none)' });
        }
        this.currentProfileId = this.profiles[0].id;
    }

}

export class ProfileFormVM {
    showing = false;
    name = '';
    accountId = '';
    apiToken = '';
    deleteVisible = false;
    saveEnabled = false;

    computeSaveEnabled() {
        this.saveEnabled = this.name.trim().length > 0 && this.apiToken.trim().length > 0 && this.accountId.trim().length > 0;
    }
}

export interface Option {
    readonly id: string;
    readonly text: string;
}

//

const STATE_KEY = 'state1';

function loadState(): State {
    try {
        const json = localStorage.getItem(STATE_KEY) || undefined;
        if (json) {
            const rt = JSON.parse(json);
            return parseState(rt);
        }
    } catch (e) {
        console.warn('loadState: Error loading state', e);
    }
    console.log('loadState: returning new state');
    return { profiles: {} };
}

// deno-lint-ignore no-explicit-any
function parseState(parsed: any): State {
    if (typeof parsed !== 'object') throw new Error(`Expected object`);
    const { profiles } = parsed;
    if (typeof profiles !== 'object') throw new Error(`Expected profiles object`);
    for (const [profileId, profileState] of Object.entries(profiles)) {
        if (typeof profileId !== 'string') throw new Error('Profile id must be string');
        parseProfileState(profileState);
    }
    return parsed as State;
}

// deno-lint-ignore no-explicit-any
function parseProfileState(parsed: any): ProfileState {
    if (typeof parsed !== 'object' || parsed === null) throw new Error('Profile state must be object');
    const { name, accountId, apiToken } = parsed;
    if (typeof name !== 'string' || name.trim().length === 0) throw new Error(`Profile state name must exist`);
    if (typeof accountId !== 'string' || accountId.trim().length === 0) throw new Error(`Profile state accountId must exist`);
    if (typeof apiToken !== 'string' || apiToken.trim().length === 0) throw new Error(`Profile state apiToken must exist`);
    return parsed as ProfileState;
}

function saveState(state: State) {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

//

interface State {
    readonly profiles: Record<string, ProfileState>; // profileId -> state
}

interface ProfileState {
    readonly name: string;
    readonly accountId: string;
    readonly apiToken: string;
}
