import { CloudflareSockets, SocketAddress, Socket, SocketOptions } from './cloudflare_workers_types.d.ts';
import { Signal } from './signal.ts';

// https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/
// https://blog.cloudflare.com/workers-tcp-socket-api-connect-databases/

export function cloudflareSockets(): CloudflareSockets {
    // deno-lint-ignore no-explicit-any
    const provider = (globalThis as any).__cloudflareSocketsProvider;
    if (typeof provider === 'function') return provider();
    return { connect: DenoSocket.connect };
}

export function parseSocketAddress(address: string | SocketAddress): SocketAddress {
    if (typeof address === 'string') {
        const m = /^([a-z0-9.-]+):(\d+)$/.exec(address);
        if (!m) throw new Error(`Bad address: ${address}`);
        const [ _, hostname, portStr ] = m;
        const port = parseInt(portStr);
        return { hostname, port };
    }
    return address;
}

//

class DenoSocket implements Socket {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<Uint8Array>;

    private address: SocketAddress;
    private readonly startTlsAllowed;
    private readonly conn: Promise<Deno.TcpConn>;
    private readonly conn2?: Promise<Deno.Conn<Deno.NetAddr>>;
    private readonly closedSignal = new Signal<void>();

    private startedTls = false;

    constructor(address: SocketAddress, options: SocketOptions) {
        this.address = address;
        const { secureTransport, allowHalfOpen } = options;
        if (allowHalfOpen) throw new Error(`unimplemented: allowHalfOpen`);

        const stream1 = new TransformStream<Uint8Array>();
        this.readable = stream1.readable;
        const stream2 = new TransformStream<Uint8Array>();
        this.writable = stream2.writable;
        this.startTlsAllowed = secureTransport === 'starttls';
        const connSignal = new Signal<Deno.TcpConn>();
        this.conn = connSignal.promise;
        const conn2Signal = secureTransport === 'on' ? new Signal<Deno.Conn<Deno.NetAddr>>() : undefined;
        this.conn2 = conn2Signal?.promise;
        (async () => {
            const { hostname, port } = address;
            const conn = await Deno.connect({ hostname, port });
            if (conn2Signal) {
                const conn2 = await Deno.startTls(conn);
                conn2.readable.pipeTo(stream1.writable);
                stream2.readable.pipeTo(conn2.writable);
                conn2Signal.resolve(conn2);
                return;
            } else if (secureTransport === 'off') {
                conn.readable.pipeTo(stream1.writable);
                stream2.readable.pipeTo(conn.writable);
            }
            connSignal.resolve(conn);
        })();
    }

    static connect(address: SocketAddress | string, options: SocketOptions = {}): Socket {
        return new DenoSocket(parseSocketAddress(address), options);
    }

    get closed(): Promise<void> {
        return this.closedSignal.promise;
    }

    async close(): Promise<void> {
        try {
            if (this.conn2) {
                const conn2 = await this.conn2;
                conn2.close();
            }
            const conn = await this.conn;
            conn.close();
        } finally {
            this.closedSignal.resolve(undefined);
        }
    }

    startTls(): Socket {
        if (!this.startTlsAllowed) throw new Error(`startTls() requires secureTransport = 'starttls' when calling connect()`);
        if (this.startedTls) throw new Error(`Already called startTls()`);
        this.startedTls = true;
        const { hostname, port } = this.address;

        const stream1 = new TransformStream<Uint8Array>();
        const stream2 = new TransformStream<Uint8Array>();
        const conn2Signal = new Signal<Deno.Conn<Deno.NetAddr>>();
        const closedSignal = new Signal<void>();

        const rt = new class implements Socket {
            readonly readable = stream1.readable;
            readonly writable = stream2.writable;
            readonly closed = closedSignal.promise;
        
            async close(): Promise<void> {
                try {
                    const conn = await conn2Signal.promise;
                    conn.close();
                } catch (e) {
                    console.warn(`Error closing tls connection to ${hostname}:${port}: ${(e as Error).stack || e}`);
                } finally {
                    closedSignal.resolve(undefined);
                }
            }

            startTls(): Socket {
                throw new Error(`Already called startTls()`);
            }
        };
        (async () => {
            const conn = await this.conn;
            const conn2 = await Deno.startTls(conn, { hostname: this.address.hostname });
            conn2.readable.pipeTo(stream1.writable);
            stream2.readable.pipeTo(conn2.writable);
            conn2Signal.resolve(conn2);
        })();
        return rt;
    }

}
