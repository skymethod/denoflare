import { CloudflareSockets, parseSocketAddress, Socket, SocketAddress, SocketOptions } from './cloudflare_sockets.ts';
import { RpcChannel } from './rpc_channel.ts';
import { Signal } from './signal.ts';

export function makeRpcCloudflareSockets(channel: RpcChannel): CloudflareSockets {
    return {
        connect: (address, options) => new RpcCloudflareSocket(parseSocketAddress(address), options ?? {}, channel),
    }
}

export type RpcSocketOpen = { readonly id: string, readonly hostname: string, readonly port: number, readonly tls: boolean }
export type RpcSocketClose = { readonly id: string }
export type RpcSocketData = { readonly id: string, readonly bytes: Uint8Array | undefined, readonly done: boolean }

//

class RpcCloudflareSocket implements Socket {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<Uint8Array>;
    readonly closed: Promise<void>;

    private readonly address: SocketAddress;
    private readonly id = crypto.randomUUID().toLowerCase();
    private readonly closedSignal = new Signal<void>();
    private readonly channel: RpcChannel;
    private readonly startTlsAllowed;
    private readonly _writable: WritableStream<Uint8Array>;
    private readonly _readable: ReadableStream<Uint8Array>;

    private startedTls = false;
    private _closed = false;

    constructor(address: SocketAddress, options: SocketOptions, channel: RpcChannel) {
        this.address = address;
        this.channel = channel;
        const { allowHalfOpen, secureTransport } = options;
        if (allowHalfOpen) throw new Error(`unimplemented: allowHalfOpen`);
        this.closed = this.closedSignal.promise;

        const stream1 = new TransformStream<Uint8Array>();
        this.readable = stream1.readable;
        this._writable = stream1.writable;
        const stream2 = new TransformStream<Uint8Array>();
        this.writable = stream2.writable;
        this._readable = stream2.readable;
        this.startTlsAllowed = secureTransport === 'starttls';
        if (this.startTlsAllowed) return;
        const tls = secureTransport === 'on';
        this.open({ tls });
    }

    async close(): Promise<void> {
        if (this._closed || this.startTlsAllowed && !this.startedTls) throw new Error(`Not closeable`);
        this._closed = true;
        const { id } = this;
        const msg: RpcSocketClose = { id };
        await this.channel.sendRequest('socket-close', msg, () => {});
        this.closedSignal.resolve(undefined);
    }

    startTls(): Socket {
        if (!this.startTlsAllowed) throw new Error(`startTls() requires secureTransport = 'starttls' when calling connect()`);
        if (this.startedTls) throw new Error(`Already called startTls()`);
        this.startedTls = true;
        this.open({ tls: true });
        return this;
    }

    //

    private open({ tls }: { tls: boolean }) {
        const { id, address, channel } = this;
        const { hostname, port } = address;
        
        const writer = this._writable.getWriter();
        channel.addRequestHandler('socket-data', async ({ id, bytes, done }: RpcSocketData) => {
            if (id !== this.id) return;
            if (bytes) await writer.write(bytes);
            if (done) await writer.close();
        });
        (async () => {
            const msg: RpcSocketOpen = { id, hostname, port, tls };
            await this.channel.sendRequest('socket-open', msg, () => {});
            for await (const bytes of this._readable) {
                const msg: RpcSocketData = { id, bytes, done: false };
                await this.channel.sendRequest('socket-data', msg, () => {});
            }
            {
                const msg: RpcSocketData = { id, bytes: undefined, done: true };
                await this.channel.sendRequest('socket-data', msg, () => {});
            }
        })();
    }

}
