import { CloudflareApiError, listScripts, listTails, Tail } from '../common/cloudflare_api.ts';
import { TailMessage } from "../common/tail.ts";
import { ErrorInfo, UnparsedMessage } from "../common/tail_connection.ts";
import { dumpMessagePretty } from "../common/tail_pretty.ts";
import { generateUuid } from '../common/uuid_v4.ts';
import { TailController, TailControllerCallbacks } from './tail_controller.ts';

// deno-lint-ignore no-explicit-any
export type ConsoleLogger = (...data: any[]) => void;

export class TailwebAppVM {
    profiles: SidebarItem[] = [];

    get selectedProfileId(): string | undefined { return this._selectedProfileId; }
    set selectedProfileId(value: string | undefined) {
        if (this._selectedProfileId === value) return;
        this._selectedProfileId = value; 
        this.onchange();
        this.findScripts();
    }

    scripts: SidebarItem[] = [];
    get selectedScriptId(): string | undefined { return this._selectedScriptId; }
    set selectedScriptId(value: string | undefined) {
        if (this._selectedScriptId === value) return;
        this._selectedScriptId = value; 
        this.onchange();
        if (this._selectedScriptId) {
            this.startTail(this._selectedScriptId);
        }
    }
    profileForm = new ProfileFormVM();

    //

    private readonly state = loadState();
    private readonly tailController: TailController;

    private _selectedProfileId: string | undefined;
    private _selectedScriptId: string | undefined;

    onchange: () => void = () => {};
    logger: ConsoleLogger = () => {};

    constructor() {
        // deno-lint-ignore no-this-alias
        const dis = this;
        const callbacks: TailControllerCallbacks = {
            onTailCreating(_accountId: string, scriptId: string) {
                dis.logger(`Creating tail for ${scriptId}...`);
            },
            onTailCreated(_accountId: string, scriptId: string, tookMillis: number, _tail: Tail) {
                dis.logger(`Created tail for ${scriptId} in ${tookMillis}ms`);
            },
            onTailConnectionOpen(_accountId: string, scriptId: string, _timeStamp: number, tookMillis: number) {
                dis.logger(`Opened tail for ${scriptId} in ${tookMillis}ms`);
            },
            onTailConnectionClose(_accountId: string, scriptId: string, _timeStamp: number, code: number, reason: string, wasClean: boolean) {
                dis.logger(`Closed tail for ${scriptId}`, {code, reason, wasClean });
            },
            onTailConnectionError(_accountId: string, scriptId: string, _timeStamp: number, errorInfo?: ErrorInfo) {
                dis.logger(`Error in tail for ${scriptId}`, { errorInfo });
            },
            onTailConnectionMessage(_accountId: string, _scriptId: string, _timeStamp: number, message: TailMessage) {
                dumpMessagePretty(message, dis.logger);
            },
            onTailConnectionUnparsedMessage(_accountId: string, scriptId: string, _timeStamp: number, message: UnparsedMessage, parseError: Error) {
                console.log(message);
                dis.logger(`Unparsed message in tail for ${scriptId}`, parseError.stack || parseError.message);
            },
        };
        this.tailController = new TailController(callbacks);
    }

    start() {
        this.reloadProfiles();
        if (this.profiles.length > 0) {
            this.selectedProfileId = this.profiles[0].id;
        } else {
            this.onchange();
        }
    }

    newProfile() {
        this.profileForm.profileId = generateUuid();
        this.profileForm.showing = true;
        this.profileForm.title = 'New Profile';
        this.profileForm.name = this.profiles.length === 0 ? 'default' : `profile${this.profiles.length + 1}`;
        this.profileForm.accountId = '';
        this.profileForm.apiToken = '';
        this.profileForm.deleteVisible = false;
        this.profileForm.enabled = true;
        this.profileForm.outputMessage = '';
        this.profileForm.computeSaveEnabled();
        this.onchange();
    }

    editProfile(profileId: string) {
        const profile = this.state.profiles[profileId];
        if (!profile) throw new Error(`Profile ${profileId} not found`);
        this._selectedProfileId = profileId;
        const { name, accountId, apiToken } = profile;
        this.profileForm.profileId = profileId;
        this.profileForm.showing = true;
        this.profileForm.title = 'Edit Profile';
        this.profileForm.name = name;
        this.profileForm.accountId = accountId;
        this.profileForm.apiToken = apiToken;
        this.profileForm.deleteVisible = true;
        this.profileForm.enabled = true;
        this.profileForm.outputMessage = '';
        this.profileForm.computeSaveEnabled();
        this.onchange();
    }

    deleteProfile(profileId: string) {
        console.log('delete profile', profileId);
        const profile = this.state.profiles[profileId];
        if (!profile) throw new Error(`Profile ${profileId} not found`);
        delete this.state.profiles[profileId];
        saveState(this.state);
        this.profileForm.showing = false;
        this.reloadProfiles();
        this.onchange();
    }

    cancelProfile() {
        this.profileForm.showing = false;
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
        const { profileForm } = this;
        const { profileId } = profileForm;
        const newProfile: ProfileState = {
            name: profileForm.name.trim(), 
            accountId: profileForm.accountId.trim(), 
            apiToken: profileForm.apiToken.trim(),
        };
        this.trySaveProfile(profileId, newProfile);
    }
        
    //

    private async trySaveProfile(profileId: string, profile: ProfileState) {
        const { profileForm } = this;
        profileForm.enabled = false;
        profileForm.progressVisible = true;
        profileForm.outputMessage = 'Checking profile...';
        this.onchange();
        try {
            const canListTails = await computeCanListTails(profile.accountId, profile.apiToken);
            if (canListTails) {
                this.state.profiles[profileId] = profile;
                saveState(this.state);
                profileForm.outputMessage = '';
                this.reloadProfiles();
                profileForm.showing = false;
            } else {
                profileForm.outputMessage = `These credentials do not have permission to tail`;
            }
        } catch (e) {
            profileForm.outputMessage = `Error: ${e.message}`;
        } finally {
            profileForm.progressVisible = false;
            profileForm.enabled = true;
            this.onchange();
        }
    }

    private reloadProfiles() {
        const { state } = this;

        this.profiles.splice(0);

        for (const [profileId, profile] of Object.entries(state.profiles)) {
            const name = profile.name || '(unnamed)';
            this.profiles.push({ id: profileId, text: name });
        }
    }

    private async findScripts() {
        try {
            if (this.selectedProfileId === undefined) return;
            const profile = this.state.profiles[this.selectedProfileId];
            if (profile === undefined) return;
            const { accountId, apiToken } = profile;
            const scripts = await listScripts(accountId, apiToken);
            this.logger(`Found ${scripts.length} scripts`);
            this.scripts.splice(0);
            this.selectedScriptId = undefined;
            for (const script of scripts) {
                this.logger(`Found script ${script.id}`);
                this.scripts.push({ id: script.id, text: script.id });
            }
            this.scripts.sort((lhs, rhs) => lhs.text.localeCompare(rhs.text));
            if (this.scripts.length > 0) {
                this.selectedScriptId = this.scripts[0].id;
            } else {
                this.onchange();
            }
        } catch (e) {
            this.logger(`Error in findScripts: ${e.stack}`);
        }
    }

    private async startTail(scriptId: string) {
        if (this.selectedProfileId === undefined) return;
        const profile = this.state.profiles[this.selectedProfileId];
        if (profile === undefined) return;
        const { accountId, apiToken } = profile;
        await this.tailController.startTail(accountId, scriptId, apiToken);
    }

}

export class ProfileFormVM {
    showing = false;
    enabled = false;
    name = '';
    accountId = '';
    apiToken = '';
    deleteVisible = false;
    saveEnabled = false;
    profileId = '';
    title = '';
    progressVisible = false;
    outputMessage = '';

    computeSaveEnabled() {
        this.saveEnabled = this.name.trim().length > 0 && this.apiToken.trim().length > 0 && this.accountId.trim().length > 0;
    }
}

export interface SidebarItem {
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

async function computeCanListTails(accountId: string, apiToken: string): Promise<boolean> {
    try {
        await listTails(accountId, '' /*unlikely script name*/, apiToken);
        return true;
    } catch (e) {
        if (e instanceof CloudflareApiError && e.status === 404) {
            // status=404, errors=10007 workers.api.error.script_not_found
            return true;
        } else {
            // status=400, errors=7003 Could not route to /accounts/.../workers/scripts/tails, perhaps your object identifier is invalid?, 7000 No route for that URI
        }
        return false;
    }
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
