import { DurableObjectNamespace } from './deps_worker.ts';
import { getIsolateId } from './isolate_id.ts';

export class CanaryClient {

    private readonly colo: string;
    private readonly isolateId: string;
    private readonly socket: WebSocket;

    constructor(colo: string, isolateId: string, socket: WebSocket) {
        this.colo = colo;
        this.isolateId = isolateId;
        this.socket = socket;
        this.socket.onclose = ev => {
            const { code, reason, wasClean } = ev;
            console.warn('onclose', { code, reason, wasClean });
        };
        this.socket.onmessage = ev => {
            const { data } = ev;
            console.warn('onmessage', { data });
        };
        this.socket.onerror = _ev => {
            console.warn('onerror', {  });
        }
    }

    static async create(WorldDO: DurableObjectNamespace, colo: string): Promise<CanaryClient> {
        const isolateId = getIsolateId();
        console.log(`CanaryClient(${colo},${isolateId}): create`);
        const name = 'world1';
        const stub = WorldDO.get(WorldDO.idFromName(name));
        const res = await stub.fetch(`world://${name}/canary/${colo}/${isolateId}`, { headers: { 'upgrade': 'websocket' }});
        if (!res.webSocket) throw new Error(`CanaryClient: no webSocket in upgrade response`);
        res.webSocket.accept();
        return new CanaryClient(colo, isolateId, res.webSocket);
    }

    register(opts: { requests: number; }) {
        const { requests } = opts;
        const { colo, isolateId } = this;
        const method = 'register';
        this.socket.send(JSON.stringify({ method, requests, isolateId, colo }));
    }

}
