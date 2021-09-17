import { createTail, Tail, TailMessage, TailOptions, setSubtract, ErrorInfo, TailConnection, TailConnectionCallbacks, UnparsedMessage } from './deps_app.ts';

export type TailKey = string; // accountId-scriptId

export interface TailControllerCallbacks {
    onTailCreating(accountId: string, scriptId: string): void;
    onTailCreated(accountId: string, scriptId: string, tookMillis: number, tail: Tail): void;
    onTailConnectionOpen(accountId: string, scriptId: string, timeStamp: number, tookMillis: number): void;
    onTailConnectionClose(accountId: string, scriptId: string, timeStamp: number, code: number, reason: string, wasClean: boolean): void;
    onTailConnectionError(accountId: string, scriptId: string, timeStamp: number, errorInfo?: ErrorInfo): void;
    onTailConnectionMessage(accountId: string, scriptId: string, timeStamp: number, message: TailMessage): void;
    onTailConnectionUnparsedMessage(accountId: string, scriptId: string, timeStamp: number, message: UnparsedMessage, parseError: Error): void;
    onTailsChanged(tailKeys: ReadonlySet<TailKey>): void;
    onNetworkStatusChanged(online: boolean): void;
    onTailFailedToStart(accountId: string, scriptId: string, trigger: string, error: Error): void;
}

export class TailController {
    private readonly callbacks: TailControllerCallbacks;
    private readonly records = new Map<TailKey, Record>();
    private readonly websocketPingIntervalSeconds: number;
    private readonly inactiveTailSeconds: number;

    private tailOptions: TailOptions = { filters: [] };
    private online?: boolean;

    constructor(callbacks: TailControllerCallbacks, opts: { websocketPingIntervalSeconds: number, inactiveTailSeconds: number }) {
        this.callbacks = callbacks;
        this.websocketPingIntervalSeconds = opts.websocketPingIntervalSeconds;
        this.inactiveTailSeconds = opts.inactiveTailSeconds;

        // deno-lint-ignore no-explicit-any
        const navigatorAsAny = window.navigator as any;
        if (typeof navigatorAsAny.onLine === 'boolean') {
            this.setOnline(navigatorAsAny.onLine);
        }
        window.addEventListener('online', () => this.setOnline(true));
        window.addEventListener('offline', () => this.setOnline(false));
    }

    setTailOptions(tailOptions: TailOptions) {
        console.log(`TailController.setTailOptions ${JSON.stringify(tailOptions)}`);
        this.tailOptions = tailOptions;
        for (const record of this.records.values()) {
            if (record.connection) {
                record.connection.setOptions(tailOptions);
            }
        }
    }

    async setTails(accountId: string, apiToken: string, scriptIds: ReadonlySet<string>) {
        const stopKeys = setSubtract(this.computeStartingOrStartedTailKeys(), new Set([...scriptIds].map(v => packTailKey(accountId, v))));
        for (const stopKey of stopKeys) {
            const record = this.records.get(stopKey)!;
            record.state = 'inactive';
            record.stopRequestedTime = Date.now();
            setTimeout(() => {
                if (record.state === 'inactive' && record.stopRequestedTime && (Date.now() - record.stopRequestedTime) >= this.inactiveTailSeconds) {
                    record.state = 'stopping';
                    console.log(`Stopping ${record.scriptId}, inactive for ${Date.now() - record.stopRequestedTime}ms`);
                    record.connection?.close(1000 /* normal closure */, 'no longer interested');
                    this.records.delete(record.tailKey);
                }
            }, this.inactiveTailSeconds * 1000);
        }
        if (stopKeys.size > 0) {
            this.dispatchTailsChanged();
        }
        for (const scriptId of scriptIds) {
            const tailKey = packTailKey(accountId, scriptId);
            const existingRecord = this.records.get(tailKey);
            if (existingRecord) {
                if (existingRecord.state === 'inactive') {
                    console.log(`Reviving inactive ${scriptId}`);
                }
                existingRecord.state = 'started';
                existingRecord.stopRequestedTime = undefined;
            } else {
                const record: Record = { state: 'starting', tailKey, apiToken, accountId, scriptId, retryCountAfterClose: 0 };
                this.records.set(tailKey, record);
                await this.startTailConnection(record);
                record.state = 'started';
            }
            this.dispatchTailsChanged();
        }
    }

    //

    private dispatchTailsChanged() {
        const tailKeys = new Set([...this.records.values()].filter(v => v.state === 'started').map(v => v.tailKey));
        this.callbacks.onTailsChanged(tailKeys);
    }

    private computeStartingOrStartedTailKeys(): Set<TailKey> {
        return new Set([...this.records.values()].filter(v => v.state === 'starting' || v.state === 'started').map(v => v.tailKey))
    }

    private setOnline(online: boolean) {
        if (online === this.online) return;
        const oldOnline = this.online;
        this.online = online;
        this.callbacks.onNetworkStatusChanged(online);
        if (typeof oldOnline === 'boolean') {
            if (online) {
                for (const record of this.records.values()) {
                    if (record.state === 'started') {
                        const { accountId, scriptId } = record;
                        this.startTailConnection(record)
                            .catch(e => this.callbacks.onTailFailedToStart(accountId, scriptId, 'restart-after-coming-online', e as Error));
                    }
                }
            } else {
                for (const record of this.records.values()) {
                    record.connection?.close(1000 /* normal closure */, 'offline');
                }
            }
        }
    }

    private async startTailConnection(record: Record) {
        const allowedToStart = record.state === 'starting' || record.state === 'started';
        if (!allowedToStart) return;
        
        const { accountId, scriptId } = unpackTailKey(record.tailKey);
        const { apiToken } = record;
        if (!record.tail || Date.now() > new Date(record.tail.expires_at).getTime() - 1000 * 60 * 5) {
            const tailCreatingTime = Date.now();
            this.callbacks.onTailCreating(accountId, scriptId);
            const tail = await createTail(accountId, scriptId, apiToken);
            record.tail = tail;
            this.callbacks.onTailCreated(accountId, scriptId, Date.now() - tailCreatingTime, tail);
        }

        // we might have been inactivated already, don't start the ws
        if (record.state === 'inactive') return;

        const { callbacks, websocketPingIntervalSeconds } = this;
        // deno-lint-ignore no-this-alias
        const dis = this;
        
        const openingTime = Date.now();
        const tailConnectionCallbacks: TailConnectionCallbacks = {
            onOpen(_cn: TailConnection, timeStamp: number) {
                record.retryCountAfterClose = 0;
                callbacks.onTailConnectionOpen(accountId, scriptId, timeStamp, Date.now() - openingTime);
            },
            onClose(_cn: TailConnection, timeStamp: number, code: number, reason: string, wasClean: boolean) {
                callbacks.onTailConnectionClose(accountId, scriptId, timeStamp, code, reason, wasClean);
                record.closeTime = Date.now();
                if (record.state === 'started' && dis.online !== false) {
                    // we didn't want to close, reschedule another TailConnection
                    record.retryCountAfterClose++;
                    const delaySeconds = Math.min(record.retryCountAfterClose * 5, 60);
                    console.log(`Will attempt to restart ${scriptId} in ${delaySeconds} seconds`);
                    setTimeout(async function() {
                        if (record.state === 'started') {
                            await dis.startTailConnection(record);
                        }
                    }, delaySeconds * 1000);
                }
            },
            onError(_cn: TailConnection, timeStamp: number, errorInfo?: ErrorInfo) {
                callbacks.onTailConnectionError(accountId, scriptId, timeStamp, errorInfo);
            },
            onTailMessage(_cn: TailConnection, timeStamp: number, message: TailMessage) {
                if (record.state !== 'started') return;
                callbacks.onTailConnectionMessage(accountId, scriptId, timeStamp, message);
            },
            onUnparsedMessage(_cn: TailConnection, timeStamp: number, message: UnparsedMessage, parseError: Error) {
                console.log('onUnparsedMessage', timeStamp, message, parseError);
                callbacks.onTailConnectionUnparsedMessage(accountId, scriptId, timeStamp, message, parseError);
            },
        };
        record.connection = new TailConnection(record.tail!.url, tailConnectionCallbacks, { websocketPingIntervalSeconds }).setOptions(this.tailOptions);
    }
    
}

export function unpackTailKey(tailKey: TailKey): { accountId: string, scriptId: string} {
    const m = /^([^\s-]+)-([^\s]+)$/.exec(tailKey);
    if (!m) throw new Error(`Bad tailKey: ${tailKey}`);
    return { accountId: m[1], scriptId: m[2] };
}

export function packTailKey(accountId: string, scriptId: string) {
    return `${accountId}-${scriptId}`;
}

//

interface Record {
    readonly tailKey: TailKey;
    readonly accountId: string;
    readonly scriptId: string;

    state: 'starting' | 'started' | 'inactive' | 'stopping';
    apiToken: string;
    retryCountAfterClose: number;

    connection?: TailConnection;
    stopRequestedTime?: number;
    closeTime?: number;
    tail?: Tail;
}

//

export class SwitchableTailControllerCallbacks implements TailControllerCallbacks {
    private readonly callbacks: TailControllerCallbacks;
    private readonly enabledFn: () => boolean;

    constructor(callbacks: TailControllerCallbacks, enabledFn: () => boolean) {
        this.callbacks = callbacks;
        this.enabledFn = enabledFn;
    }

    onTailCreating(accountId: string, scriptId: string) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailCreating(accountId, scriptId);
    }

    onTailCreated(accountId: string, scriptId: string, tookMillis: number, tail: Tail) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailCreated(accountId, scriptId, tookMillis, tail);
    }

    onTailConnectionOpen(accountId: string, scriptId: string, timeStamp: number, tookMillis: number) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailConnectionOpen(accountId, scriptId, timeStamp, tookMillis);
    }

    onTailConnectionClose(accountId: string, scriptId: string, timeStamp: number, code: number, reason: string, wasClean: boolean) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailConnectionClose(accountId, scriptId, timeStamp, code, reason, wasClean);
    }

    onTailConnectionError(accountId: string, scriptId: string, timeStamp: number, errorInfo?: ErrorInfo) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailConnectionError(accountId, scriptId, timeStamp, errorInfo);
    }

    onTailConnectionMessage(accountId: string, scriptId: string, timeStamp: number, message: TailMessage) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailConnectionMessage(accountId, scriptId, timeStamp, message);
    }

    onTailConnectionUnparsedMessage(accountId: string, scriptId: string, timeStamp: number, message: UnparsedMessage, parseError: Error) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailConnectionUnparsedMessage(accountId, scriptId, timeStamp, message, parseError);
    }

    onTailsChanged(tails: ReadonlySet<TailKey>) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailsChanged(tails);
    }

    onNetworkStatusChanged(online: boolean) {
        if (!this.enabledFn()) return;
        this.callbacks.onNetworkStatusChanged(online);
    }

    onTailFailedToStart(accountId: string, scriptId: string, trigger: string, error: Error) {
        if (!this.enabledFn()) return;
        this.callbacks.onTailFailedToStart(accountId, scriptId, trigger, error);
    }

}
