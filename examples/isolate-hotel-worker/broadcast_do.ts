import { checkEqual } from '../../common/check.ts';
import { CanaryClient } from './canary_client.ts';
import { ColoFromTrace } from './colo_from_trace.ts';
import { DurableObjectState } from './deps_worker.ts';
import { IsolateHotelWorkerEnv } from './isolate_hotel_worker_env.d.ts';
import { IsolateTracker, MutableDurableObjectInfo, newMutableDurableObjectInfo } from './isolate_info.ts';

export class BroadcastDO {
    
    private readonly state: DurableObjectState;
    private readonly env: IsolateHotelWorkerEnv;    
    private readonly sockets = new Map<string, WebSocket>();

    private colo!: string;
    private canaryClient!: CanaryClient;

    durableObjectInfo!: MutableDurableObjectInfo;

    constructor(state: DurableObjectState, env: IsolateHotelWorkerEnv) {
        this.state = state;
        this.env = env;
        this.state.blockConcurrencyWhile(async () => {
            this.colo = await new ColoFromTrace().get();
            this.durableObjectInfo = newMutableDurableObjectInfo({ type: 'broadcast', id: state.id.toString() });
            IsolateTracker.get(this.colo).registerDurableObject(this);
            this.canaryClient = await CanaryClient.create(env.WorldDO, this.colo);
        });
    }

    async fetch(request: Request): Promise<Response> {
        const version = [this.env.version, this.env.pushId].filter(v => v !== undefined).join('-');
        console.log(`version: ${version}`);
        const { colo, canaryClient } = this;
        const url = new URL(request.url);
        const durableObjectName = request.headers.get('do-name') || url.hostname;
        this.durableObjectInfo.name = durableObjectName;
        this.durableObjectInfo.atts['version'] = version;
        console.log('logprops:', { colo, durableObjectClass: 'WorldDO', durableObjectId: this.state.id.toString(), durableObjectName });
        const { pathname } = url;

        try {
            return this.tryHandleWs(pathname, request) 
                || await this.tryHandleChange(pathname, request) 
                || new Response('not found', { status: 404 });
        } finally {
            this.durableObjectInfo.fetches++;
            canaryClient.register(IsolateTracker.get(colo).info());
        }
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
