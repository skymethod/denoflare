import { CanaryServer } from './canary_server.ts';
import { ColoFromTrace } from './colo_from_trace.ts';
import { DurableObjectState } from './deps_worker.ts';
import { IsolateHotelWorkerEnv } from './isolate_hotel_worker_env.d.ts';

export class WorldDO {
    
    private readonly state: DurableObjectState;
    private readonly env: IsolateHotelWorkerEnv;
    private readonly canaryServer = new CanaryServer();

    private colo!: string;

    constructor(state: DurableObjectState, env: IsolateHotelWorkerEnv) {
        this.state = state;
        this.env = env;
        this.state.blockConcurrencyWhile(async () => {
            this.colo = await new ColoFromTrace().get();
            setInterval(() => {
                const name = 'broadcast';
                const stub = env.BroadcastDO.get(env.BroadcastDO.idFromName(name));
                stub.fetch(`broadcast://${name}/change`, { method: 'POST', body: JSON.stringify({ time: new Date().toISOString() })});
            }, 5000);
        });
    }

    fetch(request: Request): Response {
        console.log(`version: ${[this.env.version, this.env.pushId].filter(v => v !== undefined).join('-')}`);
        const { colo } = this;
        const url = new URL(request.url);
        console.log('logprops:', { colo, durableObjectClass: 'WorldDO', durableObjectId: this.state.id.toString(), durableObjectName: url.hostname });
        const { pathname } = url;
        const res = this.canaryServer.tryHandle(pathname, request);
        if (res) return res;
        return new Response('not found', { status: 404 });
    }

}
