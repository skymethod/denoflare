import { checkEqual } from '../../common/check.ts';
import { ColoFromTrace } from './colo_from_trace.ts';
import { DurableObjectState } from './deps_worker.ts';
import { IsolateHotelWorkerEnv } from './isolate_hotel_worker_env.d.ts';

export class BroadcastDO {
    
    private readonly state: DurableObjectState;
    private readonly env: IsolateHotelWorkerEnv;    
    private readonly sockets = new Map<string, WebSocket>();

    private colo!: string;

    constructor(state: DurableObjectState, env: IsolateHotelWorkerEnv) {
        this.state = state;
        this.env = env;
        this.state.blockConcurrencyWhile(async () => {
            this.colo = await new ColoFromTrace().get();
        });
    }

    async fetch(request: Request): Promise<Response> {
        console.log(`version: ${[this.env.version, this.env.pushId].filter(v => v !== undefined).join('-')}`);
        const { colo } = this;
        const url = new URL(request.url);
        console.log('logprops:', { colo, durableObjectClass: 'WorldDO', durableObjectId: this.state.id.toString(), durableObjectName: request.headers.get('do-name') || url.hostname });
        const { pathname } = url;
        return this.tryHandleWs(pathname, request) 
            || await this.tryHandleChange(pathname, request) 
            || new Response('not found', { status: 404 });
    }

    //

    private async tryHandleChange(pathname: string, request: Request): Promise<Response | undefined> {
        if (pathname !== '/change') return undefined;
        checkEqual('request.method', request.method, 'POST');
        const payload = await request.text();
        for (const socket of this.sockets.values()) {
            socket.send(payload);
        }
        console.log(`Sent change to ${this.sockets.size} clients`);
    }

    private tryHandleWs(pathname: string, request: Request): Response | undefined {
        const m = /^\/ws\/(.+)$/.exec(pathname);
        if (!m) return undefined;
        const upgrade = request.headers.get('upgrade') || undefined;
        if (upgrade !== 'websocket') return new Response('expected upgrade: websocket', { status: 400 });
        const clientId = m[1];
        const pair = new WebSocketPair();
        const socket = pair[1];
        this.sockets.set(clientId, socket);
        socket.accept();
        socket.addEventListener('close', event => {
            const { code, reason, wasClean } = event;
            this.sockets.delete(clientId);
            console.warn('close', { clientId, clients: this.sockets.size, code, reason, wasClean });
        });
        socket.addEventListener('error', _event => {
            console.warn('error');
        });
        return new Response(null, { status: 101, webSocket: pair[0] });
    }

}
