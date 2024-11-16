// deno-lint-ignore-file no-explicit-any
import { CloudflareWebSocketExtensions } from '../common/cloudflare_workers_types.d.ts';
import { Data } from '../common/rpc_channel.ts';
import { RpcChannel } from '../common/rpc_channel.ts';
import { FakeWebSocket } from '../common/fake_web_socket.ts';
import { Side } from '../common/rpc_stub_web_sockets.ts';

export class RpcHostWebSockets {
    static VERBOSE = false;

    private readonly channel: RpcChannel;
    private readonly pairs = new Map<string, Pair>();

    constructor(channel: RpcChannel) {
        this.channel = channel;

        channel.addRequestHandler('ws-allocate', (data: Data) => {
            const { isolateId, id } = data;
            if (typeof isolateId !== 'string') throw new Error(`Bad isolateId: ${isolateId}`);
            if (typeof id !== 'number') throw new Error(`Bad id: ${id}`);
            const pairId = packPairId(isolateId, id);
            if (this.pairs.has(pairId)) throw new Error(`Bad pairId: ${pairId}, already allocated`);
            this.pairs.set(pairId, new Pair(channel, isolateId, id));
            return Promise.resolve();
        });

        channel.addRequestHandler('ws-from-stub', (data: Data) => {
            const { method } = data;
            if (method === 'accept') {
                const { isolateId, id, seq, side } = data;
                if (typeof isolateId !== 'string') throw new Error(`Bad isolateId: ${isolateId}`);
                if (typeof id !== 'number') throw new Error(`Bad id: ${id}`);
                if (typeof seq !== 'number') throw new Error(`Bad seq: ${seq}`);
                if (side !== 'client' && side !== 'server') throw new Error(`Bad side: ${side}`);
                this.ensurePair(isolateId, id).get(side).receiveAccept(seq);
                return Promise.resolve();
            } else if (method === 'send') {
                const { isolateId, id, seq, side, data: messageData } = data;
                if (typeof isolateId !== 'string') throw new Error(`Bad isolateId: ${isolateId}`);
                if (typeof id !== 'number') throw new Error(`Bad id: ${id}`);
                if (typeof seq !== 'number') throw new Error(`Bad seq: ${seq}`);
                if (side !== 'client' && side !== 'server') throw new Error(`Bad side: ${side}`);
                const to = side === 'client' ? 'server' : 'client';
                // console.log(`ws-from-stub send ${JSON.stringify({ isolateId, id, seq, side, messageData, to })}`);
                this.ensurePair(isolateId, id).get(to).dispatchMessageData(messageData);
                return Promise.resolve();
            } else {
                throw new Error(`RpcWebSocketHost: ws-from-stub: '${method}' not implemented`);
            }
        });
    }

    unpackWebSocket(webSocketId: string): WebSocket & CloudflareWebSocketExtensions {
        const m = /^([0-9a-f]+)-(\d+)-(client|server)$/.exec(webSocketId);
        if (!m) throw new Error(`RpcWebSocketHost: unpackWebSocket: Bad webSocketId: ${webSocketId}`);
        const isolateId = m[1];
        const id = parseInt(m[2]);
        const side: Side = m[3] === 'client' ? 'client' : 'server';
        return this.ensurePair(isolateId, id).get(side);
    }

    packWebSocket(_webSocket: WebSocket & CloudflareWebSocketExtensions): string {
        throw new Error(`RpcWebSocketHost: packWebSocket not implemented`);
    }

    //

    private ensurePair(isolateId: string, id: number): Pair {
        const pairId = packPairId(isolateId, id);
        const pair = this.pairs.get(pairId);
        if (!pair) throw new Error(`RpcWebSocketHost: no pair for ${pairId}`);
        return pair;
    }

}

//

function packPairId(isolateId: string, id: number) {
    return `${isolateId}-${id}`;
}

//

class Pair {
    readonly server: RpcHostWebSocket;
    readonly client: RpcHostWebSocket;

    constructor(channel: RpcChannel, isolateId: string, id: number) {
        this.server = new RpcHostWebSocket('server', channel, isolateId, id);
        this.client = new RpcHostWebSocket('client', channel, isolateId, id);
    }

    get(side: Side): RpcHostWebSocket {
        return side === 'client' ? this.client : this.server;
    }

}

class RpcHostWebSocket extends FakeWebSocket implements CloudflareWebSocketExtensions {
    private readonly _className: string;
    private readonly side: Side;
    private readonly isolateId: string;
    private readonly id: number;
    private readonly channel: RpcChannel;
    private readonly messageListeners: EventListenerOrEventListenerObject[] = [];

    private accepted = false;
    private remoteAccepted = false;
    private _onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null;
    private _onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null;
    private nextExpectedSeq = 1;

    constructor(side: Side, channel: RpcChannel, isolateId: string, id: number) {
        const className = `RpcHostWebSocket(${side},${isolateId},${id})`;
        super(className);
        this.side = side;
        this._className = className;
        this.isolateId = isolateId;
        this.id = id;
        this.channel = channel;
        if (RpcHostWebSockets.VERBOSE) console.log(`${this._className}: new`);
    }

    accept() {
        if (this.side !== 'client') throw new Error(`${this._className}: accept can only be called on client sockets`);
        if (this.accepted) throw new Error(`${this._className}: already accepted`);
        this.accepted = true;
        console.log(`${this._className}: local accepted`);
    }

    override get onmessage(): ((this: WebSocket, ev: MessageEvent) => any) | null {
        if (!this.accepted) throw new Error(`${this._className}: onmessage called before accept`);
        return this._onmessage; 
    }

    override set onmessage(value: ((this: WebSocket, ev: MessageEvent) => any) | null) { 
        if (!this.accepted) throw new Error(`${this._className}: onmessage called before accept`);
        this._onmessage = value;
    }

    override get onclose(): ((this: WebSocket, ev: CloseEvent) => any) | null { 
        if (!this.accepted) throw new Error(`${this._className}: onclose called before accept`);
        return this._onclose;
     }

    override set onclose(value: ((this: WebSocket, ev: CloseEvent) => any) | null) { 
        if (!this.accepted) throw new Error(`${this._className}: onclose called before accept`);
        this._onclose = value;
    }

    override send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        if (this.side !== 'client') throw new Error(`${this._className}: send can only be called on client sockets`);
        if (!this.accepted) throw new Error(`${this._className}: send called before accept`);
        const { isolateId, id } = this;
        const to = this.side === 'client' ? 'server' : 'client';
        this.channel.fireRequest('ws-to-stub', { method: 'send', data, isolateId, id, to });
    }

    override close(code?: number, reason?: string): void {
        if (this.side !== 'client') throw new Error(`${this._className}: close can only be called on client sockets`);
        if (!this.accepted) throw new Error(`${this._className}: close called before accept`);
        const to = this.side === 'client' ? 'server' : 'client';
        const { isolateId, id } = this;
        this.channel.fireRequest('ws-to-stub', { method: 'close', isolateId, id, to, code, reason });
    }

    //

    receiveAccept(seq: number) {
        this.checkSeq(seq);
        if (this.accepted) throw new Error(`${this._className}.receiveAccept: Already accepted`);
        this.accepted = true;
        this.remoteAccepted = true;
        console.log(`${this._className}: remote accepted`);
    }

    dispatchMessageData(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        if (!this.accepted) throw new Error(`${this._className}.dispatchMessageData: not accepted`);
        const { side } = this;
        // console.log(`${this._className}.dispatchMessageData: remoteAccepted=${this.remoteAccepted} this.onmessage=${!!this.onmessage} this.messageListeners=${this.messageListeners.length}`);
        if (!this.remoteAccepted) {
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
        } else {
            const { isolateId, id } = this;
            this.channel.fireRequest('ws-to-stub', { method: 'send', data, isolateId, id, to: side });
        }
    }

    //

    private checkSeq(seq: number) {
        if (this.nextExpectedSeq !== seq) throw new Error(`Bad seq: ${seq}, expected ${this.nextExpectedSeq}`);
        this.nextExpectedSeq++;
    }

}
