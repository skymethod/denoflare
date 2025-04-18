export class Server {
    private readonly sockets = new Map<string, WebSocket>();
    private readonly debug: boolean;

    readonly id: string;

    constructor(id: string, debug: boolean = false) {
        this.id = id;
        this.debug = debug;
    }
    
    broadcast(obj: Record<string, unknown>) {
        obj.serverId = this.id;
        obj.clients = this.sockets.size;
        const json = JSON.stringify(obj);
        for (const socket of this.sockets.values()) {
            socket.send(json);
        }
    }

    tryHandle(pathname: string, request: Request, debug: string): Response | undefined {
        const m = /^\/ws\/(.+)$/.exec(pathname);
        if (!m) return undefined;
        const upgrade = request.headers.get('upgrade') || undefined;
        if (upgrade !== 'websocket') return new Response('expected upgrade: websocket', { status: 400 });
        const clientId = m[1];
        const pair = new WebSocketPair();
        const socket = pair[1];
        this.sockets.set(clientId, socket);
        socket.accept();
        socket.addEventListener('message', event => {
            try {
                const obj = JSON.parse(event.data);
                if (obj.t === 'open') {
                    if (typeof obj.clientId !== 'string') throw new Error(`Bad clientId: ${obj.clientId}`);
                    this.broadcast({ t: 'opened', clientId, clients: this.sockets.size, debug });
                }
            } catch (e) {
                this.broadcast({ t: 'messageError', clientId, msg: `Error handling event.data: ${event.data}, ${(e as Error).stack || e}` });
            }
        })
        socket.addEventListener('close', event => {
            const { code, reason, wasClean } = event;
            this.sockets.delete(clientId);
            this.broadcast({ t: 'closed', clientId, clients: this.sockets.size, code, reason, wasClean });
        });
        socket.addEventListener('error', event => {
            this.sockets.delete(clientId);
            this.broadcast({ t: 'errored', clientId, clients: this.sockets.size, event });
        });
        return new Response(null, { status: 101, webSocket: pair[0], headers: { 'debug': debug } });
    }

}
