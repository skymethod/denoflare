// deno-lint-ignore-file no-explicit-any
import { CloudflareWebSocketExtensions } from '../common/cloudflare_workers_types.d.ts';
import { FakeWebSocket } from './fake_web_socket.ts';

export class LocalWebSockets {
    static VERBOSE = false;

    private readonly pairs = new Map<number, Pair>();

    private nextId = 1;

    allocateNewWebSocketPair(): { server: WebSocket & CloudflareWebSocketExtensions, client: WebSocket } {
        const id = this.nextId++;
        const client = new LocalWebSocket(id, 'client', this);
        const server = new LocalWebSocket(id, 'server', this);
        this.pairs.set(id, { client, server });
        return { server, client };
    }
    
    dispatch(id: number, to: Side, data: string | ArrayBufferLike | Blob | ArrayBufferView): void { 
        const pair = this.pairs.get(id);
        if (!pair) throw new Error(`Bad id: ${id}`);
        (to === 'client' ? pair.client : pair.server).dispatchMessageData(data);
    }

}

//

type Side =  'client' | 'server';

interface Pair {
    readonly server: LocalWebSocket;
    readonly client: LocalWebSocket;
}

class LocalWebSocket extends FakeWebSocket implements CloudflareWebSocketExtensions {
    private readonly _className: string;
    private readonly sockets: LocalWebSockets;
    private readonly side: Side;
    private readonly id: number;
    private readonly pendingMessageEvents: MessageEvent[] = [];
    private readonly messageListeners: EventListenerOrEventListenerObject[] = [];
    private readonly closeListeners: EventListenerOrEventListenerObject[] = [];
    private readonly errorListeners: EventListenerOrEventListenerObject[] = [];

    private _accepted = false;
    private _onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null;
    private _onopen: ((this: WebSocket, ev: Event) => any) | null = null;
    private _onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null;
    private _onerror: ((this: WebSocket, ev: Event | ErrorEvent) => any) | null = null;
    private _readyState: number = WebSocket.CONNECTING;

    constructor(id: number, side: Side, sockets: LocalWebSockets) {
        const className = `LocalWebSocket(${side})`;
        super(className);
        this._className = className;
        this.id = id;
        this.side = side;
        this.sockets = sockets;
    }

    //

    override get onmessage(): ((this: WebSocket, ev: MessageEvent) => any) | null { return this._onmessage; }
    override set onmessage(value: ((this: WebSocket, ev: MessageEvent) => any) | null) { this._onmessage = value; }
    override get onopen(): ((this: WebSocket, ev: Event) => any) | null { return this._onopen; }
    override set onopen(value: ((this: WebSocket, ev: Event) => any) | null) { this._onopen = value; }
    override get onclose(): ((this: WebSocket, ev: CloseEvent) => any) | null { return this._onclose; }
    override set onclose(value: ((this: WebSocket, ev: CloseEvent) => any) | null) { this._onclose = value; }
    override get onerror(): ((this: WebSocket, ev: Event | ErrorEvent) => any) | null { return this._onerror; }
    override set onerror(value: ((this: WebSocket, ev: Event | ErrorEvent) => any) | null) { this._onerror = value; }

    override get readyState(): number {
        return this._readyState;
    }

    accept(): void {
        if (this._accepted) throw new Error(`${this._className}: Cannot accept(), already accepted`);
        if (LocalWebSockets.VERBOSE) console.log(`${this._className}: accept!`);
        this._readyState = WebSocket.OPEN;
        this._accepted = true;
        for (const event of this.pendingMessageEvents) {
            this.dispatchEvent(event);
        }
        this.pendingMessageEvents.splice(0);
    }

    override addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
    ): void {
        if (listener === null) return;
        if (options) throw new Error(`${this._className}: addEventListener.${type}.options not implemented`);
        if (type === 'message') {
            this.messageListeners.push(listener);
        } else if (type === 'close') {
            this.closeListeners.push(listener);
        } else if (type === 'error') {
            this.errorListeners.push(listener);
        } else {
            throw new Error(`${this._className}.addEventListener: '${type}' not implemented`);
        }
    }

    override send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void { 
        if (LocalWebSockets.VERBOSE) console.log(`${this._className}.${this.id}: send ${data}`);
        if (!this._accepted) throw new Error(`${this._className}: Cannot send() before accept()`);
        this.sockets.dispatch(this.id, this.side === 'client' ? 'server' : 'client', data);
    }

    //

    dispatchMessageData(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        if (LocalWebSockets.VERBOSE) console.log(`${this._className}.${this.id}: dispatchMessageData ${data} accepted=${this._accepted} this.onmessage=${!!this.onmessage}`);
        const event = new MessageEvent('message', { data });
        if (this._accepted) {
            this.dispatchMessageEvent(event);
        } else {
            this.pendingMessageEvents.push(event);
        }
    }

    //
    
    private dispatchMessageEvent(event: MessageEvent) {
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

    private dispatchCloseEvent(event: CloseEvent) {
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

