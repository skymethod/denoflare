import { createTail, Tail } from '../common/cloudflare_api.ts';
import { setSubtract } from '../common/sets.ts';
import { TailMessage, TailOptions } from '../common/tail.ts';
import { ErrorInfo, TailConnection, TailConnectionCallbacks, UnparsedMessage } from '../common/tail_connection.ts';

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
}

const INACTIVE_TAIL_MILLIS = 5000; // reclaim inactive tails older than this

export class TailController {
    private readonly callbacks: TailControllerCallbacks;
    private readonly records = new Map<TailKey, Record>();
    private tailOptions: TailOptions = { filters: [] };

    constructor(callbacks: TailControllerCallbacks) {
        this.callbacks = callbacks;
    }

    setTailOptions(tailOptions: TailOptions) {
        this.tailOptions = tailOptions;
        for (const record of this.records.values()) {
            if (record.connection) {
                record.connection.setOptions(tailOptions);
            }
        }
    }

    async setTails(accountId: string, apiToken: string, scriptIds: ReadonlySet<string>) {
        const stopKeys = setSubtract(this.computeStartingOrStartedTailKeys(), new Set([...scriptIds].map(v => computeTailKey(accountId, v))));
        for (const stopKey of stopKeys) {
            const record = this.records.get(stopKey)!;
            record.state = 'inactive';
            record.stopRequestedTime = Date.now();
            setTimeout(() => {
                if (record.state === 'inactive' && record.stopRequestedTime && (Date.now() - record.stopRequestedTime) >= INACTIVE_TAIL_MILLIS) {
                    record.state = 'closing';
                    console.log(`Closing ${unpackTailKey(record.tailKey).scriptId}, inactive for ${Date.now() - record.stopRequestedTime}ms`);
                    record.connection?.close(1000 /* normal closure */, 'no longer interested');
                    this.records.delete(record.tailKey);
                }
            }, INACTIVE_TAIL_MILLIS);
        }
        if (stopKeys.size > 0) {
            this.dispatchTailsChanged();
        }
        for (const scriptId of scriptIds) {
            const tailKey = computeTailKey(accountId, scriptId);
            const existingRecord = this.records.get(tailKey);
            if (existingRecord) {
                if (existingRecord.state === 'inactive') {
                    console.log(`Reviving inactive ${scriptId}`);
                }
                existingRecord.state = 'started';
                existingRecord.stopRequestedTime = undefined;
            } else {
                const record: Record = { state: 'starting', tailKey };
                this.records.set(tailKey, record);

                const tailCreatingTime = Date.now();
                this.callbacks.onTailCreating(accountId, scriptId);
                const tail = await createTail(accountId, scriptId, apiToken);
                this.callbacks.onTailCreated(accountId, scriptId, Date.now() - tailCreatingTime, tail);
                
                // we might have been inactivated already, don't start the ws
                if (record.state !== 'starting') return;

                const { callbacks } = this;
                const openingTime = Date.now();
                const tailConnectionCallbacks: TailConnectionCallbacks = {
                    onOpen(_cn: TailConnection, timeStamp: number) {
                        callbacks.onTailConnectionOpen(accountId, scriptId, timeStamp, Date.now() - openingTime);
                    },
                    onClose(_cn: TailConnection, timeStamp: number, code: number, reason: string, wasClean: boolean) {
                        callbacks.onTailConnectionClose(accountId, scriptId, timeStamp, code, reason, wasClean);
                    },
                    onError(_cn: TailConnection, timeStamp: number, errorInfo?: ErrorInfo) {
                        callbacks.onTailConnectionError(accountId, scriptId, timeStamp, errorInfo);
                    },
                    onTailMessage(_cn: TailConnection, timeStamp: number, message: TailMessage) {
                        if (record.state !== 'started') return;
                        callbacks.onTailConnectionMessage(accountId, scriptId, timeStamp, message);
                    },
                    onUnparsedMessage(_cn: TailConnection, timeStamp: number, message: UnparsedMessage, parseError: Error) {
                        callbacks.onTailConnectionUnparsedMessage(accountId, scriptId, timeStamp, message, parseError);
                    },
                };
                record.connection = new TailConnection(tail.url, tailConnectionCallbacks).setOptions(this.tailOptions);
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
    
}

export function unpackTailKey(tailKey: TailKey): { accountId: string, scriptId: string} {
    const m = /^([^\s-]+)-([^\s]+)$/.exec(tailKey);
    if (!m) throw new Error(`Bad tailKey: ${tailKey}`);
    return { accountId: m[1], scriptId: m[2] };
}

//

function computeTailKey(accountId: string, scriptId: string) {
    return `${accountId}-${scriptId}`;
}

//

interface Record {
    readonly tailKey: TailKey;
    state: 'starting' | 'started' | 'inactive' | 'closing';
    connection?: TailConnection;
    stopRequestedTime?: number;
}
