import { CloudflareApiError, listScripts, listTails, Tail } from '../common/cloudflare_api.ts';
import { setEqual, setIntersect, setSubtract } from '../common/sets.ts';
import { isTailMessageCronEvent, parseHeaderFilter, TailFilter, TailMessage, TailOptions } from '../common/tail.ts';
import { ErrorInfo, UnparsedMessage } from '../common/tail_connection.ts';
import { formatLocalYyyyMmDdHhMmSs, dumpMessagePretty } from '../common/tail_pretty.ts';
import { generateUuid } from '../common/uuid_v4.ts';
import { TailController, TailControllerCallbacks, TailKey, unpackTailKey } from './tail_controller.ts';

// deno-lint-ignore no-explicit-any
export type ConsoleLogger = (...data: any[]) => void;

export class TailwebAppVM {

    profiles: TextItem[] = [];

    get selectedProfileId(): string | undefined { return this._selectedProfileId; }
    set selectedProfileId(value: string | undefined) {
        if (this._selectedProfileId === value) return;
        this._selectedProfileId = value; 
        this.onchange();
        this.state.selectedProfileId = value;
        saveState(this.state);
        this.findScripts();
    }

    scripts: TextItem[] = [];
    get selectedScriptIds(): ReadonlySet<string> { return this._selectedScriptIds; }
    set selectedScriptIds(scriptIds: ReadonlySet<string>) {
        if (setEqual(this._selectedScriptIds, scriptIds)) return;
        this._selectedScriptIds = new Set(scriptIds);
        this.onchange();
        const profile = this.selectedProfileId && this.state.profiles[this.selectedProfileId];
        if (profile) {
            profile.selectedScriptIds = [...scriptIds];
            saveState(this.state);
        }
        this.setTails();
    }
    profileForm = new ProfileFormVM();
    filterForm = new FilterFormVM();
    filter: FilterState = {};
    tails: ReadonlySet<TailKey> = new Set();
    extraFields: string[] = [];

    //

    private readonly state = loadState();
    private readonly tailController: TailController;

    private _selectedProfileId: string | undefined;
    private _selectedScriptIds: ReadonlySet<string> = new Set<string>();

    onchange: () => void = () => {};
    logger: ConsoleLogger = () => {};

    constructor() {
        // deno-lint-ignore no-this-alias
        const dis = this;

        const logTailsChange = (action: string, tailKeys: ReadonlySet<TailKey>) => {
            if (tailKeys.size > 0) this.logWithPrefix(`${action} ${[...tailKeys].map(v => unpackTailKey(v).scriptId).sort().join(', ')}`);
        };

        const logWithPrefix = this.logWithPrefix.bind(this);
        const verboseWithPrefix = this.verboseWithPrefix.bind(this);

        const callbacks: TailControllerCallbacks = {
            onTailCreating(_accountId: string, scriptId: string) {
                verboseWithPrefix(`Creating tail for ${scriptId}...`);
            },
            onTailCreated(_accountId: string, scriptId: string, tookMillis: number, tail: Tail) {
                verboseWithPrefix(`Created tail for ${scriptId} in ${tookMillis}ms, ${JSON.stringify(tail)}`);
            },
            onTailConnectionOpen(_accountId: string, scriptId: string, _timeStamp: number, tookMillis: number) {
                verboseWithPrefix(`Opened tail for ${scriptId} in ${tookMillis}ms`);
            },
            onTailConnectionClose(accountId: string, scriptId: string, timeStamp: number, code: number, reason: string, wasClean: boolean) {
                console.log('onTailConnectionClose', { accountId, scriptId, timeStamp, code, reason, wasClean });
                verboseWithPrefix(`Closed tail for ${scriptId}, ${JSON.stringify({code, reason, wasClean })}`);
            },
            onTailConnectionError(accountId: string, scriptId: string, timeStamp: number, errorInfo?: ErrorInfo) {
                console.log('onTailConnectionError', { accountId, scriptId, timeStamp, errorInfo });
                logWithPrefix(`Error in tail for ${scriptId}`, { errorInfo });
            },
            onTailConnectionMessage(_accountId: string, _scriptId: string, _timeStamp: number, message: TailMessage) {
                if (computeMessagePassesFilter(message, dis.filter)) {
                    dumpMessagePretty(message, dis.logger);
                }
            },
            onTailConnectionUnparsedMessage(_accountId: string, scriptId: string, _timeStamp: number, message: UnparsedMessage, parseError: Error) {
                console.log(message);
                logWithPrefix(`Unparsed message in tail for ${scriptId}`, parseError.stack || parseError.message);
            },
            onTailsChanged(tails: ReadonlySet<TailKey>) {
                if (setEqual(dis.tails, tails)) return;
                // dis.logger('onTailsChanged', [...tails].map(v => unpackTailKey(v).scriptId));
                const removed = setSubtract(dis.tails, tails);
                logTailsChange('Untailing', removed);
                const added = setSubtract(tails, dis.tails);
                logTailsChange('Tailing', added);
                dis.tails = tails;
                dis.onchange();
            }
        };
        this.tailController = new TailController(callbacks);

        this.extraFields = [...(this.state.extraFields || [])];
        this.filter = this.state.filter || {};
        this.applyFilter({ save: false });
    }

    start() {
        this.reloadProfiles();
        this.performInitialSelection();
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
        this.performInitialSelection();
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

    editEventFilter() {
        const { filter, filterForm } = this;
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Event type:';
        filterForm.fieldValueChoices = [
            { id: 'all', text: 'All' }, 
            { id: 'cron', text: 'CRON trigger' }, 
            { id: 'http', text: 'HTTP request' },
        ];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = filter.event1 === 'http' ? 'http' : filter.event1 === 'cron' ? 'cron' : 'all';
        filterForm.helpText = 'Choose which types of events to show';
        filterForm.applyValue = () => {
            if (filter.event1 === filterForm.fieldValue) return;
            filter.event1 = filterForm.fieldValue;
            this.applyFilter({ save: true });
            const selectedChoiceText = filterForm.fieldValueChoices.find(v => v.id === filterForm.fieldValue)!.text;
            this.logWithPrefix(`Event type filter changed to: ${selectedChoiceText}`)
        };
        this.onchange();
    }

    editStatusFilter() {
        const { filter, filterForm } = this;
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Status:';
        filterForm.fieldValueChoices = [
            { id: 'all', text: 'All' }, 
            { id: 'success', text: 'Success' }, 
            { id: 'error', text: 'Error' },
        ];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = filter.status1 === 'success' ? 'success' : filter.status1 === 'error' ? 'error' : 'all';
        filterForm.helpText = 'Show events this this status';
        filterForm.applyValue = () => {
            if (filter.status1 === filterForm.fieldValue) return;
            filter.status1 = filterForm.fieldValue;
            this.applyFilter({ save: true });
            const selectedChoiceText = filterForm.fieldValueChoices.find(v => v.id === filterForm.fieldValue)!.text;
            this.logWithPrefix(`Status filter changed to: ${selectedChoiceText}`)
        };
        this.onchange();
    }

    editIpAddressFilter() {
        const { filter, filterForm } = this;
        const isValidIpAddress = (ipAddress: string) => {
            return /^(self|[\d\.:a-f]{3,})$/.test(ipAddress); // 2001:db8:3:4::192.0.2.33, doesn't need to be comprehensive
        };
        const checkValidIpAddress = (ipAddress: string) => {
            if (!isValidIpAddress(ipAddress)) throw new Error(`Bad ip address: ${ipAddress}`);
            return ipAddress;
        };
        const parseFilterIpAddressesFromFieldValue = () => {
            const { fieldValue } = filterForm;
            const v = (fieldValue || '').trim();
            if (v === '') return [];
            return distinct(v.split(',').map(v => v.trim().toLowerCase()).filter(v => v !== '').map(checkValidIpAddress));
        };
        const computeFieldValueFromFilterIpAddresses = () => {
            return distinct(filter.ipAddress1 || []).join(', ');
        };
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'IP address(s):';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = computeFieldValueFromFilterIpAddresses();
        filterForm.helpText = `'self' to filter your own address, comma-separated if multiple, e.g. self, 1.1.1.1`;
        filterForm.applyValue = () => {
            const newValue = parseFilterIpAddressesFromFieldValue();
            if (setEqual(new Set(filter.ipAddress1 || []), new Set(newValue))) return;
            filter.ipAddress1 = newValue;
            this.applyFilter({ save: true });
            const text = newValue.length === 0 ? 'any IP address' : newValue.join(', ');
            this.logWithPrefix(`IP address filter changed to: ${text}`);
        };
        this.onchange();
    }

    editMethodFilter() {
        const { filter, filterForm } = this;
        const parseFilterMethodsFromFieldValue = () => {
            const { fieldValue } = filterForm;
            const v = (fieldValue || '').trim();
            if (v === '') return [];
            return distinct(v.split(',').map(v => v.trim().toUpperCase()).filter(v => v !== ''));
        };
        const computeFieldValueFromFilterMethods = () => {
            return distinct(filter.method1 || []).map(v => v.toUpperCase()).join(', ');
        };
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'HTTP Method(s):';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = computeFieldValueFromFilterMethods();
        filterForm.helpText = 'comma-separated if multiple, e.g. GET, POST';
        filterForm.applyValue = () => {
            const newValue = parseFilterMethodsFromFieldValue();
            if (setEqual(new Set(filter.method1 || []), new Set(newValue))) return;
            filter.method1 = newValue;
            this.applyFilter({ save: true });
            const text = newValue.length === 0 ? 'any method' : newValue.join(', ');
            this.logWithPrefix(`Method filter changed to: ${text}`);
        };
        this.onchange();
    }

    editSamplingRateFilter() {
        const parseSampleRateFromFieldValue = () => {
            const { fieldValue } = filterForm;
            const v = (fieldValue || '').trim();
            if (v === '') return 1;
            const num = parseFloat(v);
            if (!isValidSamplingRate(num)) throw new Error(`Invalid rate: ${v}`);
            return num;
        };
        const { filter, filterForm } = this;
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Sampling rate:';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = (typeof filter.samplingRate1 === 'number' && isValidSamplingRate(filter.samplingRate1) ? filter.samplingRate1 : 1).toFixed(2);
        filterForm.helpText = 'Can range from 0 (0%) to 1 (100%)';
        filterForm.applyValue = () => {
            const newValue = parseSampleRateFromFieldValue();
            if (filter.samplingRate1 === newValue) return;
            filter.samplingRate1 = newValue;
            this.applyFilter({ save: true });
            const text = newValue === 1 ? 'no sampling' : `${newValue} (${(newValue * 100).toFixed(2)}%)`;
            this.logWithPrefix(`Sample rate filter changed to: ${text}`);
        };
        this.onchange();
    }

    editSearchFilter() {
        const { filter, filterForm } = this;
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Search text:';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = filter.search1 || '';
        filterForm.helpText = 'Filter by a text match in console.log messages';
        filterForm.applyValue = () => {
            if (filter.search1 === filterForm.fieldValue) return;
            filter.search1 = filterForm.fieldValue;
            this.applyFilter({ save: true });
            const text = (filter.search1 || '').length === 0 ? 'no search filter' : `'${filter.search1}'`;
            this.logWithPrefix(`Search filter changed to: ${text}`);
        };
        this.onchange();
    }

    editHeaderFilter() {
        const { filter, filterForm } = this;
        const parseFilterHeadersFromFieldValue = () => {
            const { fieldValue } = filterForm;
            const v = (fieldValue || '').trim();
            if (v === '') return [];
            return distinct(v.split(',').map(v => v.trim()).filter(v => v !== ''));
        };
        const computeFieldValueFromFilterHeaders = () => {
            return distinct(filter.header1 || []).join(', ');
        };
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Header(s):';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = [];
        filterForm.fieldValue = computeFieldValueFromFilterHeaders();
        filterForm.helpText = `'key', or 'key:query', comma-separated if multiple`;
        filterForm.applyValue = () => {
            const newValue = parseFilterHeadersFromFieldValue();
            if (setEqual(new Set(filter.header1 || []), new Set(newValue))) return;
            filter.header1 = newValue;
            this.applyFilter({ save: true });
            const text = newValue.length === 0 ? 'no header filter' : newValue.join(', ');
            this.logWithPrefix(`Header filter changed to: ${text}`);
        };
        this.onchange();
    }

    hasAnyFilters(): boolean {
        const { filter } = this;
        const { event1 } = filter;
        return computeTailOptionsForFilter(filter).filters.length > 0 || typeof event1 === 'string' && event1 !== '' && event1 !== 'all';
    }

    resetFilters() {
        this.filter = {};
        this.applyFilter({ save: true });
        this.logWithPrefix(`Filters reset`);
        this.onchange();
    }

    cancelFilter() {
        console.log('cancelFilter');
        this.filterForm.showing = false;
        this.onchange();
    }

    saveFilter() {
        console.log('saveFilter');
        const { filterForm } = this;
        filterForm.enabled = false;
        filterForm.outputMessage = 'Checking filter...';
        this.onchange();
        try {
            filterForm.applyValue();
            filterForm.outputMessage = ``;
            filterForm.showing = false;
        } catch (e) {
            filterForm.outputMessage = `Error: ${e.message}`;
        } finally {
            filterForm.enabled = true;
            this.onchange();
        }
    }

    selectFilterChoice(id: string) {
        if (this.filterForm.fieldValue === id) return;
        this.filterForm.fieldValue = id;
        this.onchange();
    }

    editSelectionFields() {
        const { filterForm } = this;
        filterForm.showing = true;
        filterForm.enabled = true;
        filterForm.fieldName = 'Additional fields:';
        filterForm.fieldValueChoices = [];
        filterForm.fieldValueOptions = EXTRA_FIELDS_OPTIONS;
        filterForm.fieldValue = (this.extraFields || []).join(',');
        filterForm.helpText = 'Select additional fields to show in the output';
        filterForm.applyValue = () => {
            const newValues = distinct((filterForm.fieldValue || '').split(',').map(v => v.trim()).filter(v => v !== ''));
            if (setEqual(new Set(this.extraFields || []), new Set(newValues))) return;
            this.extraFields = newValues;
            this.applyFilter({ save: true});
            const extraFieldsText = this.computeSelectionFieldsText();
            this.logWithPrefix(`Output fields changed to: ${extraFieldsText}`)
        };
        this.onchange();
    }

    computeSelectionFieldsText(): string {
        return ['standard fields', ...this.extraFields.map(id => EXTRA_FIELDS_OPTIONS.find(v => v.id === id)?.text || id)].join(', ');
    }

    toggleFilterOption(id: string) {
        const extraFields = distinct((this.filterForm.fieldValue || '').split(',').map(v => v.trim()).filter(v => v !== ''));
        const i = extraFields.indexOf(id);
        if (i >= 0) {
            extraFields.splice(i, 1);
        } else {
            extraFields.push(id);
        }
        const fieldValue = extraFields.join(',');
        if (this.filterForm.fieldValue === fieldValue) return;

        this.filterForm.fieldValue = fieldValue;
        this.onchange();
    }
    
    //

    private applyFilter(opts: { save: boolean }) {
        const { save } = opts;
        this.state.filter = this.filter;
        this.state.extraFields = this.extraFields;
        if (save) saveState(this.state);
        const tailOptions = computeTailOptionsForFilter(this.filter);
        this.tailController.setTailOptions(tailOptions);
    }

    // deno-lint-ignore no-explicit-any
    private logWithPrefix(...data: any) {
        const time = formatLocalYyyyMmDdHhMmSs(new Date());
        if (data.length > 0 && typeof data[0] === 'string') {
            data = [`[%c${time}%c] ${data[0]}`, 'color: gray', '', ...data.slice(1)];
        }
        this.logger(...data);
    }

    private verboseWithPrefix(message: string) {
        const time = formatLocalYyyyMmDdHhMmSs(new Date());
        this.logger(`[%c${time}%c] %c${message}%c`, 'color: gray', '', 'color: gray');
    }

    private performInitialSelection() {
        const initiallySelectedProfileId = computeInitiallySelectedProfileId(this.state, this.profiles);
        if (initiallySelectedProfileId) {
            console.log(`Initially selecting profile: ${this.state.profiles[initiallySelectedProfileId].name}`);
            this.selectedProfileId = initiallySelectedProfileId;
        } else {
            this.onchange();
        }
    }

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
                this.selectedProfileId = profileId;
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
            this.verboseWithPrefix(`Finding scripts for ${profile.name.toUpperCase()}...`);
            const start = Date.now();
            const scripts = await listScripts(accountId, apiToken);
            this.verboseWithPrefix(`Found ${scripts.length} scripts in ${Date.now() - start}ms`);
            this.scripts.splice(0);
            for (const script of scripts) {
                // this.logger(`Found script ${script.id}`);
                this.scripts.push({ id: script.id, text: script.id });
            }
            this.scripts.sort((lhs, rhs) => lhs.text.localeCompare(rhs.text));
            const selectedScriptIds = this.computeSelectedScriptIdsAfterFindScripts();
            if (selectedScriptIds.size > 0) {
                this.selectedScriptIds = selectedScriptIds;
            }
            this.onchange();
        } catch (e) {
            this.logger(`Error in findScripts: ${e.stack}`);
        }
    }

    private computeSelectedScriptIdsAfterFindScripts(): Set<string> {
        if (this.scripts.length === 0) {
            console.log('Initially selecting no scripts, no scripts to select');
            return new Set();
        }
        if (this.selectedProfileId && this.selectedProfileId && this.selectedProfileId === this.state.selectedProfileId) {
            const initialProfile = this.state.profiles[this.selectedProfileId];
            if (initialProfile && initialProfile.selectedScriptIds && initialProfile.selectedScriptIds.length > 0) {
                const currentScriptIds = new Set(this.scripts.map(v => v.id));
                const candidates = setIntersect(currentScriptIds, new Set(initialProfile.selectedScriptIds));
                if (candidates.size > 0) {
                    console.log(`Initially selecting script${candidates.size === 1 ? '' : 's'} ${[...candidates].sort().join(', ')}: remembered from last time`);
                    return candidates;
                }
            }
        }
        const firstScriptId = this.scripts[0].id
        console.log(`Initially selecting script ${firstScriptId}: first one in the list`);
        return new Set([this.scripts[0].id]); // first one in the list
    }

    private async setTails() {
        if (this.selectedProfileId === undefined) return;
        const profile = this.state.profiles[this.selectedProfileId];
        if (profile === undefined) return;
        const { accountId, apiToken } = profile;
        try {
            await this.tailController.setTails(accountId, apiToken, this._selectedScriptIds);
        } catch (e) {
            this.logger('Error in setTails', e.stack || e.message);
        }
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

export class FilterFormVM {
    showing = false;
    enabled = false;
    fieldName = '';
    fieldValueChoices: TextItem[] = [];
    fieldValueOptions: TextItem[] = [];
    fieldValue?: string; // (fieldValueChoices: selected item id) (fieldValueOptions: comma-sep item ids) (text: free form text from input)
    helpText = '';
    outputMessage = '';
    applyValue: () => void = () => {};
}

export interface TextItem {
    readonly id: string;
    readonly text: string;
}

export interface FilterState {
    event1?: string; // all, cron, http
    status1?: string; // all, error, success
    ipAddress1?: string[]; // addresses, or self
    method1?: string[]; // GET, POST, etc
    samplingRate1?: number;  // 0 to 1
    search1?: string; // search string
    header1?: string[]; // foo, or foo:bar
}

//

const EXTRA_FIELDS_OPTIONS: TextItem[] = [
    { id: 'ip-address', text: 'IP address' }, 
    { id: 'user-agent', text: 'User agent' }, 
];

const STATE_KEY = 'state1';

function loadState(): State {
    try {
        const json = localStorage.getItem(STATE_KEY) || undefined;
        if (json) {
            const obj = JSON.parse(json);
            const rt = parseState(obj);
            // console.log('loadState: returning state', JSON.stringify(rt));
            return rt;
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

function isValidSamplingRate(samplingRate: number): boolean {
    return !isNaN(samplingRate) && samplingRate >= 0 && samplingRate <= 1;
}

function computeInitiallySelectedProfileId(state: State, profiles: TextItem[]) {
    if (state.selectedProfileId && state.profiles[state.selectedProfileId]) return state.selectedProfileId;
    if (profiles.length > 0) return profiles[0].id;
    return undefined;
}

function computeTailOptionsForFilter(filter: FilterState): TailOptions {
    const filters: TailFilter[] = [];
    if (filter.status1 === 'error') {
        filters.push({ outcome: [ 'exception', 'exceededCpu', 'canceled', 'unknown' ]});
    } else if (filter.status1 === 'success') {
        filters.push({ outcome: [ 'ok' ]});
    }
    if (filter.samplingRate1 !== undefined && isValidSamplingRate(filter.samplingRate1) && filter.samplingRate1 < 1) {
        filters.push({ sampling_rate: filter.samplingRate1 });
    }
    if (filter.search1 !== undefined && filter.search1.length > 0) {
        filters.push({ query: filter.search1 });
    }
    if (filter.method1 && filter.method1.length > 0) {
        filters.push({ method: filter.method1 });
    }
    if (filter.ipAddress1 && filter.ipAddress1.length > 0) {
        filters.push({ client_ip: filter.ipAddress1 });
    }
    if (filter.header1 && filter.header1.length > 0) {
        for (const header of filter.header1) {
            filters.push(parseHeaderFilter(header));
        }
    }
    return { filters };
}

function computeMessagePassesFilter(message: TailMessage, filter: FilterState): boolean {
    if (filter.event1 === 'cron' || filter.event1 === 'http') {
        const isCron = isTailMessageCronEvent(message);
        return isCron && filter.event1 === 'cron' || !isCron && filter.event1 === 'http';
    }
    return true;
}

function distinct(values: string[]): string[] { // and maintain order
    const rt: string[] = [];
    for (const value of values) {
        if (!rt.includes(value)) {
            rt.push(value);
        }
    }
    return rt;
}

//

interface State {
    readonly profiles: Record<string, ProfileState>; // profileId -> state
    selectedProfileId?: string;
    filter?: FilterState;
    extraFields?: string[]; // ip-address, user-agent
}

interface ProfileState {
    readonly name: string;
    readonly accountId: string;
    readonly apiToken: string;
    selectedScriptIds?: string[];
}
