import { ColoFromTrace } from './colo_from_trace.ts';
import { DurableObjectState } from './deps.ts';
import { getIsolateId } from './isolate_id.ts';
import { Server } from './server.ts';

export class ColoTierDO {
    private readonly state: DurableObjectState;

    constructor(state: DurableObjectState) {
        this.state = state;
    }

    async fetch(request: Request): Promise<Response> {
        console.log(request.url);
        const colo = await COLO_FROM_TRACE.get();
        const durableObjectName = request.headers.get('do-name');
        const isolateId = 'colo-tier-' + durableObjectName + '-' + getIsolateId(colo);
        const server = this.ensureServer(isolateId);
        const url = new URL(request.url);
        const { pathname } = url;
        this.ensureTicking();
        console.log('logprops:', { colo, durableObjectClass: 'ColoTierDO', durableObjectId: this.state.id.toString(), durableObjectName });
       
        const wsResponse = server.tryHandle(pathname, request, isolateId);
        if (wsResponse) return wsResponse;

        return new Response('not found', { status: 404 });
    }

    //

    _server: Server | undefined;

    private ensureServer(serverId: string): Server {
        if (this._server) return this._server;
        this._server = new Server(serverId, true);
        return this._server;
    }

    _ticking = false;

    private ensureTicking() {
        if (this._ticking) return;
        this._ticking = true;
        setInterval(() => {
            const now = new Date().toISOString();
            this._server?.broadcast({ t: 'tick', now });
        }, 5000);
    }

}

const COLO_FROM_TRACE = new ColoFromTrace();
