// deno-lint-ignore-file no-explicit-any
import { CloudflareWebSocketExtensions } from './cloudflare_workers_types.d.ts';
import { FakeWebSocket } from './fake_web_socket.ts';
import { Data, RpcChannel } from './rpc_channel.ts';

export class RpcStubWebSockets {

    private readonly channel: RpcChannel;
    private readonly isolateId: string;
    private readonly pairs = new Map<number, Pair>();

    private nextId = 1;

    constructor(channel: RpcChannel) {
        this.channel = channel;
        this.isolateId = crypto.randomUUID().split('-').pop()!;

        channel.addRequestHandler('ws-to-stub', (data: Data) => {
            const { method } = data;
            if (method === 'send') {
                const { data: messageData, isolateId, id, to } = data;
                if (typeof isolateId !== 'string' || isolateId !== this.isolateId) throw new Error(`Bad isolateId: ${isolateId}`);
                if (typeof id !== 'number') throw new Error(`Bad id: ${id}`);
                if (to !== 'client' && to !== 'server') throw new Error(`Bad to: ${to}`);
                const pair = this.pairs.get(id);
                if (!pair) throw new Error(`Bad id: ${id}`);
                // console.log(`ws-to-stub send ${JSON.stringify({ isolateId, id, messageData, to })}`);
                pair.get(to).dispatchMessageData(messageData);
            } else if (method === 'close') {
                const { code, reason, isolateId, id, to } = data;
                if (typeof isolateId !== 'string' || isolateId !== this.isolateId) throw new Error(`Bad isolateId: ${isolateId}`);
                if (typeof id !== 'number') throw new Error(`Bad id: ${id}`);
                if (to !== 'client' && to !== 'server') throw new Error(`Bad to: ${to}`);
                const pair = this.pairs.get(id);
                if (!pair) throw new Error(`Bad id: ${id}`);
                if (code !== undefined && typeof code !== 'number') throw new Error(`Bad code: ${code}`);
                if (reason !== undefined && typeof reason !== 'string') throw new Error(`Bad reason: ${reason}`);
                pair.get(to).dispatchClose(code, reason);
            } else {
                throw new Error(`RpcStubWebSockets: ws-to-stub method '${method}' not implemented`);
            }
            return Promise.resolve();
        });
    }

    allocateNewWebSocketPair(): { server: WebSocket & CloudflareWebSocketExtensions; client: WebSocket; } {
        const id = this.nextId++;
        const { isolateId, channel } = this;
        const pair = new Pair(channel, isolateId, id);
        this.pairs.set(id, pair);
        channel.fireRequest('ws-allocate', { isolateId, id });
        return pair;
    }

    packWebSocket(socket: WebSocket & CloudflareWebSocketExtensions): string {
        if (!isRpcStubWebSocket(socket)) throw new Error(`RpcStubWebSockets: packWebSocket: must be RpcStubWebSocket`);
        return `${socket.isolateId}-${socket.id}-${socket.side}`;
        
    }

    unpackWebSocket(_socket: string): WebSocket & CloudflareWebSocketExtensions {
        throw new Error(`RpcStubWebSockets: unpackWebSocket not implemented`);
    }

}

export type Side =  'client' | 'server';

//

function isRpcStubWebSocket(socket: WebSocket): socket is RpcStubWebSocket {
    return (socket as any).kind === 'RpcStubWebSocket';
}

function dumpOpenWarning() {
    console.warn('WARNING: ws open event is not called for cf sockets, opened after .accept()');
}

//

class Pair {
    readonly server: RpcStubWebSocket;
    readonly client: RpcStubWebSocket;

    constructor(channel: RpcChannel, isolateId: string, id: number) {
        this.server = new RpcStubWebSocket('server', channel, isolateId, id);
        this.client = new RpcStubWebSocket('client', channel, isolateId, id);
    }

    get(side: Side): RpcStubWebSocket {
        return side === 'client' ? this.client : this.server;
    }

}

class RpcStubWebSocket extends FakeWebSocket implements CloudflareWebSocketExtensions {
    readonly kind = 'RpcStubWebSocket';
    readonly isolateId: string;
    readonly id: number;
    readonly side: Side;

    private readonly _className: string;
    private readonly channel: RpcChannel;
    private readonly messageListeners: EventListenerOrEventListenerObject[] = [];
    private readonly closeListeners: EventListenerOrEventListenerObject[] = [];
    private readonly errorListeners: EventListenerOrEventListenerObject[] = [];
    private readonly openListeners: EventListenerOrEventListenerObject[] = [];

    private nextSeq = 1;
    private _onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null;
    private _onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null;
    private _onopen: ((this: WebSocket, ev: Event) => any) | null = null;
    private _onerror: ((this: WebSocket, ev: Event | ErrorEvent) => any) | null = null;

    constructor(side: Side, channel: RpcChannel, isolateId: string, id: number) {
        const className = `RpcStubWebSocket(${side},${isolateId},${id})`;
        super(className);
        this._className = className;
        this.channel = channel;
        this.isolateId = isolateId;
        this.id = id;
        this.side = side;
    }

    get onmessage(): ((this: WebSocket, ev: MessageEvent) => any) | null { return this._onmessage; }
    set onmessage(value: ((this: WebSocket, ev: MessageEvent) => any) | null) { this._onmessage = value; }

    get onclose(): ((this: WebSocket, ev: CloseEvent) => any) | null { return this._onclose; }
    set onclose(value: ((this: WebSocket, ev: CloseEvent) => any) | null) { this._onclose = value; }

    get onopen(): ((this: WebSocket, ev: Event) => any) | null { return this._onopen; }
    set onopen(value: ((this: WebSocket, ev: Event) => any) | null) { this._onopen = value; dumpOpenWarning(); }

    // not implemented yet, but don't crash
    get onerror(): ((this: WebSocket, ev: Event | ErrorEvent) => any) | null { return this._onerror; }
    set onerror(value: ((this: WebSocket, ev: Event | ErrorEvent) => any) | null) { this._onerror = value; }

    get binaryType(): BinaryType {
        return 'arraybuffer'; // default for Deno.  CF runtime returns undefined, but in practice uses ArrayBuffer as the message event data.
    }

    accept() {
        const { isolateId, id, side } = this;
        const seq = this.nextSeq++;
        this.channel.fireRequest('ws-from-stub', { method: 'accept', id, isolateId, seq, side });
    }

    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
    ): void {
        if (listener === null) return;
        if (options) throw new Error(`${this._className}.addEventListener: options not implemented`);
        if (type === 'message') {
            this.messageListeners.push(listener);
        } else if (type === 'close') {
            this.closeListeners.push(listener);
        } else if (type === 'error') {
            this.errorListeners.push(listener);
        } else if (type === 'open') {
            this.openListeners.push(listener);
            dumpOpenWarning();
        } else {
            throw new Error(`${this._className}.addEventListener: '${type}' not implemented`);
        }
    }

    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        const { isolateId, id, side } = this;
        const seq = this.nextSeq++;
        // console.log(`${this._className}.send: '${JSON.stringify({ isolateId, id, side, data })}`);
        this.channel.fireRequest('ws-from-stub', { method: 'send', id, isolateId, data, seq, side });
    }

    //

    dispatchMessageData(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        // console.log(`${this._className}.dispatchMessageData:`);
        const event = new MessageEvent('message', { data });
        if (this.onmessage) {
            this.onmessage(event);
        }
        for (const listener of this.messageListeners) {
            if (typeof listener === 'object') {
                listener.handleEvent(event);
            } else {
                listener(event);
            }
        }
    }

    dispatchClose(code: number | undefined, reason: string | undefined) {
        const event = new CloseEvent('close', { code, reason });
        if (this.onclose) {
            this.onclose(event);
        }
        for (const listener of this.closeListeners) {
            if (typeof listener === 'object') {
                listener.handleEvent(event);
            } else {
                listener(event);
            }
        }
    }

}
