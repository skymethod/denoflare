import { Socket, cloudflareSockets } from './cloudflare_sockets.ts';
import { copy } from 'https://deno.land/std@0.214.0/bytes/copy.ts'; // intended to be self-contained, don't use shared deps

const { connect } = cloudflareSockets();

export async function cfConnect(options: Deno.ConnectOptions): Promise<Deno.TcpConn> { // typeof Deno.connect
    await Promise.resolve();
    const { DEBUG } = CloudflareSocketsDenoConnFactory;
    if (DEBUG) console.log(`cfConnect(${JSON.stringify({ options })})`);
    const { hostname, port, transport } = options;
    if (transport !== 'tcp') throw new Error(`Invalid transport: ${transport}`);
    if (typeof hostname !== 'string') throw new Error(`Invalid hostname: ${hostname}`);
    const socket = connect({ hostname, port }, { });
    return new SocketDenoConn(socket);
}

export async function cfStartTls(conn: Deno.Conn, options?: Deno.StartTlsOptions): Promise<Deno.TlsConn> { // typeof Deno.startTls
    await Promise.resolve();
    throw new Error(`cfStartTls(${JSON.stringify({ conn, options })}) not implemented`);
}

export const CloudflareSocketsDenoConnFactory = {
    DEBUG: false,
}

//

class SocketDenoConn implements Deno.TcpConn {
    private readonly socket: Socket;

    private closed = false;

    constructor(socket: Socket) {
        this.socket = socket;
    }

    get localAddr(): Deno.Addr {
        throw new Error(`SocketDenoConn: localAddr() not implemented`);
    }

    get remoteAddr(): Deno.Addr {
        throw new Error(`SocketDenoConn: remoteAddr() not implemented`);
    }

    get rid(): number {
        throw new Error(`SocketDenoConn: rid() not implemented`);
    }

    closeWrite(): Promise<void> {
        throw new Error(`SocketDenoConn: closeWrite() not implemented`);
    }

    ref(): void {
        throw new Error(`SocketDenoConn: ref() not implemented`);
    }

    unref(): void {
        throw new Error(`SocketDenoConn: unref() not implemented`);
    }

    get readable(): ReadableStream<Uint8Array> {
        this.checkNotClosed();
        return this.socket.readable;
    }

    get writable(): WritableStream<Uint8Array> {
        this.checkNotClosed();
        return this.socket.writable;
    }

    async read(p: Uint8Array): Promise<number | null> {
        this.checkNotClosed();
        const { DEBUG } = CloudflareSocketsDenoConnFactory;
        if (DEBUG) console.log(`SocketDenoConn.read(${p.length})`);
        const buf = new Uint8Array(p.length);
        const reader = this.socket.readable.getReader({ mode: 'byob'});
        const { done: _, value } = await reader.read(buf);
        reader.releaseLock();
        if (value) {
            if (DEBUG) console.log(`SocketDenoConn.read returning ${value.length}`);
            copy(value, p, 0);
            return value.length;
        }
        if (DEBUG) console.log(`SocketDenoConn.read returning null`);
        return null;
    }

    async write(p: Uint8Array): Promise<number> {
        this.checkNotClosed();
        const { DEBUG } = CloudflareSocketsDenoConnFactory;
        if (DEBUG) console.log(`SocketDenoConn.write(${p.length})`);
        const writer = this.socket.writable.getWriter();
        await writer.write(p);
        writer.releaseLock();
        return p.length;
    }

    close(): void {
        if (this.closed) return;
        this.closed = true;
        this.socket.close();
    }

    setNoDelay(noDelay?: boolean | undefined): void {
        throw new Error(`SocketDenoConn: setNoDelay(${JSON.stringify({ noDelay })}) not implemented`);
    }

    setKeepAlive(keepAlive?: boolean | undefined): void {
        throw new Error(`SocketDenoConn: setKeepAlive(${JSON.stringify({ keepAlive })}) not implemented`);
    }

    [Symbol.dispose](): void {
        this.close();
    }

    //

    private checkNotClosed() {
        if (this.closed) throw new Error(`Socket is closed`);
    }

}
