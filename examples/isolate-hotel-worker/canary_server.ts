export class CanaryServer {

    private readonly sockets = new Map<string, WebSocket>();

    tryHandle(pathname: string, request: Request): Response | undefined {
        const m = /^\/canary\/(.+)\/(.+)$/.exec(pathname);
        if (!m) return undefined;
        const upgrade = request.headers.get('upgrade') || undefined;
        if (upgrade !== 'websocket') return new Response('expected upgrade: websocket', { status: 400 });
        const colo = m[1];
        const isolateId = m[2];
        const clientId = `${colo}-${isolateId}`;
        const pair = new WebSocketPair();
        const socket = pair[1];
        this.sockets.set(clientId, socket);
        socket.accept();
        socket.addEventListener('message', event => {
            try {
                const obj = JSON.parse(event.data);
                console.log('message', clientId, obj);
            } catch (e) {
                console.warn('message error', clientId, e.stack || e);
            }
        });
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
