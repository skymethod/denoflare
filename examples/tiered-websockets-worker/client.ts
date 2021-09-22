export class Client {
    private readonly socket: WebSocket;

    constructor(socket: WebSocket, clientId: string, republish: (data: Record<string, unknown>) => void) {
        socket.addEventListener('message', event => {
            const msg = JSON.parse(event.data);
            republish({ t: 'message', msg, clientId });
        });
        socket.addEventListener('close', event => {
            const { code, reason, wasClean } = event;
            republish({ t: 'close', clientId, code, reason, wasClean });
        });
        socket.addEventListener('error', event => {
            republish({ t: 'error', clientId, event });
        });
        this.socket = socket;

        // cf sockets are assumed open after accept!
        this.send({ t: 'open', clientId });
    }

    send(data: Record<string, unknown>) {
        this.socket.send(JSON.stringify(data));
    }
    
}
