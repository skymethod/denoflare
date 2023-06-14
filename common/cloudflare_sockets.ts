import { Signal } from './signal.ts';

// https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/
// https://blog.cloudflare.com/workers-tcp-socket-api-connect-databases/

export function cloudflareSockets(): CloudflareSockets {
    return { connect: DenoSocket.connect };
}

export interface CloudflareSockets {
    connect(address: SocketAddress | string, options?: SocketOptions): Socket;
}

export interface SocketAddress {
    /** The hostname to connect to. Example: cloudflare.com */
    readonly hostname: string;

    /** The port number to connect to. Example: 5432  */
    readonly port: number;
}

export interface SocketOptions {
    /** Specifies whether or not to use TLS when creating the TCP socket. Defaults to off */
    readonly secureTransport?: 'off' | 'on' | 'starttls';

    /** Defines whether the writable side of the TCP socket will automatically close on end-of-file (EOF).
     * 
     * When set to false, the writable side of the TCP socket will automatically close on EOF. When set to true, the writable side of the TCP socket will remain open on EOF.*/
    readonly allowHalfOpen?: boolean;
}

export interface Socket {

    /** Returns the readable side of the TCP socket. */
    readonly readable: ReadableStream<Uint8Array>;

    /** Returns the writable side of the TCP socket. */
    readonly writable: WritableStream<Uint8Array>;

    /** This promise is resolved when the socket is closed and is rejected if the socket encounters an error. */
    readonly closed: Promise<void>;

    /** Closes the TCP socket. Both the readable and writable streams are forcibly closed. */
    close(): Promise<void>;

    /** Upgrades an insecure socket to a secure one that uses TLS, returning a new Socket.
     * 
     * Note that in order to call startTls(), you must set secureTransport to starttls when initially calling connect() to create the socket. */
    startTls(): Socket;
}

//

class DenoSocket implements Socket {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<Uint8Array>;

    private address: SocketAddress;
    private readonly startTlsAllowed;
    private readonly conn: Promise<Deno.Conn>;
    private readonly conn2?: Promise<Deno.Conn>;
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
        const connSignal = new Signal<Deno.Conn>();
        this.conn = connSignal.promise;
        const conn2Signal = secureTransport === 'on' ? new Signal<Deno.Conn>() : undefined;
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
        const parseSocketAddress = () => {
            if (typeof address === 'string') {
                const m = /^([a-z0-9.-]+):(\d+)$/.exec(address);
                if (!m) throw new Error(`Bad address: ${address}`);
                const [ _, hostname, portStr ] = m;
                const port = parseInt(portStr);
                return { hostname, port };
            }
            return address;
        }
        return new DenoSocket(parseSocketAddress(), options);
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
        const conn2Signal = new Signal<Deno.Conn>();
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
                    console.warn(`Error closing tls connection to ${hostname}:${port}: ${e.stack || e}`);
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
