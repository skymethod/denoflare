import { createTail, Tail } from '../common/cloudflare_api.ts';
import { TailMessage } from '../common/tail.ts';
import { ErrorInfo, TailConnection, TailConnectionCallbacks, UnparsedMessage } from '../common/tail_connection.ts';

export interface TailControllerCallbacks {
    onTailCreating(accountId: string, scriptId: string): void;
    onTailCreated(accountId: string, scriptId: string, tookMillis: number, tail: Tail): void;
    onTailConnectionOpen(accountId: string, scriptId: string, timeStamp: number, tookMillis: number): void;
    onTailConnectionClose(accountId: string, scriptId: string, timeStamp: number, code: number, reason: string, wasClean: boolean): void;
    onTailConnectionError(accountId: string, scriptId: string, timeStamp: number, errorInfo?: ErrorInfo): void;
    onTailConnectionMessage(accountId: string, scriptId: string, timeStamp: number, message: TailMessage): void;
    onTailConnectionUnparsedMessage(accountId: string, scriptId: string, timeStamp: number, message: UnparsedMessage, parseError: Error): void;
    onTailCountChanged(tailCount: number): void;
}

export class TailController {
    private readonly callbacks: TailControllerCallbacks;
    private readonly records = new Map<string, Record>();

    constructor(callbacks: TailControllerCallbacks) {
        this.callbacks = callbacks;
    }

    async startTail(accountId: string, scriptId: string, apiToken: string) {
        const key = computeRecordKey(accountId, scriptId);
        if (this.records.has(key)) return;

        const record: Record = { state: 'starting' };
        this.records.set(key, record);

        const tailCreatingTime = Date.now();
        this.callbacks.onTailCreating(accountId, scriptId);
        const tail = await createTail(accountId, scriptId, apiToken);
        this.callbacks.onTailCreated(accountId, scriptId, Date.now() - tailCreatingTime, tail);

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
                callbacks.onTailConnectionMessage(accountId, scriptId, timeStamp, message);
            },
            onUnparsedMessage(_cn: TailConnection, timeStamp: number, message: UnparsedMessage, parseError: Error) {
                callbacks.onTailConnectionUnparsedMessage(accountId, scriptId, timeStamp, message, parseError);
            },
        };
        record.connection = new TailConnection(tail.url, tailConnectionCallbacks);
        record.state = 'started';
        callbacks.onTailCountChanged(this.records.size);
    }
    
}

//

function computeRecordKey(accountId: string, scriptId: string) {
    return `${accountId}-${scriptId}`;
}

//

interface Record {
    state: 'starting' | 'started';
    connection?: TailConnection;
}
