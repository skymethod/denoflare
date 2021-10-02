import { CanaryServer } from './canary_server.ts';
import { ColoFromTrace } from './colo_from_trace.ts';
import { DurableObjectState } from './deps_worker.ts';
import { IsolateHotelWorkerEnv } from './isolate_hotel_worker_env.d.ts';
import { IsolateTracker, MutableDurableObjectInfo, newMutableDurableObjectInfo } from './isolate_info.ts';

export class WorldDO {
    
    private readonly state: DurableObjectState;
    private readonly env: IsolateHotelWorkerEnv;
    private readonly canaryServer = new CanaryServer();

    durableObjectInfo!: MutableDurableObjectInfo;

    private colo!: string;

    constructor(state: DurableObjectState, env: IsolateHotelWorkerEnv) {
        this.state = state;
        this.env = env;
        this.state.blockConcurrencyWhile(async () => {
            this.colo = await new ColoFromTrace().get();
            this.durableObjectInfo = newMutableDurableObjectInfo({ type: 'world', id: state.id.toString() });
            IsolateTracker.get(this.colo).registerDurableObject(this);
            setInterval(() => {
                const name = 'broadcast';
                const stub = env.BroadcastDO.get(env.BroadcastDO.idFromName(name));
                stub.fetch(`broadcast://${name}/change`, { method: 'POST', body: JSON.stringify({ time: new Date().toISOString(), isolates: packIsolates(this.canaryServer) })});
            }, 5000);
        });
       
    }

    fetch(request: Request): Response {
        const version = [this.env.version, this.env.pushId].filter(v => v !== undefined).join('-');
        console.log(`version: ${version}`);
        const { colo } = this;
        const url = new URL(request.url);
        const durableObjectName = url.hostname;
        console.log('logprops:', { colo, durableObjectClass: 'WorldDO', durableObjectId: this.state.id.toString(), durableObjectName });
        this.durableObjectInfo.name = durableObjectName;
        this.durableObjectInfo.atts['version'] = version;
        const { pathname } = url;
        try {
            const res = this.canaryServer.tryHandle(pathname, request);
            if (res) return res;
            return new Response('not found', { status: 404 });
        } finally {
            this.durableObjectInfo.fetches++;
            this.canaryServer.register(IsolateTracker.get(colo).info());
        }
    }

}

//

function packIsolates(canaryServer: CanaryServer): Record<string, unknown> {
    const rt: Record<string, unknown> = {};
    for (const [ key, value ] of canaryServer.isolates.entries()) {
        rt[key] = value;
    }
    return rt;
}
