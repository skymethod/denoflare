import { RpcChannel } from '../common/rpc_channel.ts';
import { RpcSocketClose, RpcSocketData, RpcSocketOpen } from '../common/rpc_cloudflare_sockets.ts';

export class RpcHostSockets {
    static VERBOSE = false;

    private readonly channel: RpcChannel;
    private readonly records = new Map<string, SocketRecord>();

    constructor(channel: RpcChannel) {
        this.channel = channel;

        channel.addRequestHandler('socket-open', async ({ id, hostname, port, tls }: RpcSocketOpen) => {
            const conn = await Deno.connect({ hostname, port });
            const conn2 = tls ? await Deno.startTls(conn, { hostname }) : undefined;
            const writer = (conn2?.writable ?? conn.writable).getWriter();
            if (RpcHostSockets.VERBOSE) console.log(`RpcHostSockets(${id}): opened ${JSON.stringify({ hostname, port, tls })}`);
            this.records.set(id, { id, hostname, port, tls, conn, conn2, writer });
            const readable = conn2?.readable ?? conn.readable;
            (async () => {
                for await (const bytes of readable) {
                    const msg: RpcSocketData = { id, bytes, done: false };
                    if (RpcHostSockets.VERBOSE) console.log(`RpcHostSockets(${id}): sending ${JSON.stringify({ len: bytes.length })}`);
                    await channel.sendRequest('socket-data', msg, () => {});
                }
                const msg: RpcSocketData = { id, bytes: undefined, done: true };
                if (RpcHostSockets.VERBOSE) console.log(`RpcHostSockets(${id}): sending done`);
                await channel.sendRequest('socket-data', msg, () => {});
            })();
        });

        channel.addRequestHandler('socket-data', async ({ id, bytes, done }: RpcSocketData) => {
            const record = this.records.get(id);
            if (!record) throw new Error(`Unknown socket id: ${id}`);
            if (bytes) {
                if (RpcHostSockets.VERBOSE) console.log(`RpcHostSockets(${id}): receiving ${JSON.stringify({ len: bytes.length })}`);
                await record.writer.write(bytes);
            }
            if (done) {
                await record.writer.close();
            }
        });

        channel.addRequestHandler('socket-close', async ({ id }: RpcSocketClose) => {
            const record = this.records.get(id);
            if (!record) throw new Error(`Unknown socket id: ${id}`);
            const { hostname, port, conn, conn2 } = record;
            await Promise.resolve();
            try {
                (conn2 ?? conn).close();
            } catch (e) {
                console.warn(`Error closing connection to ${hostname}:${port}: ${e.stack}`)
            } finally {
                this.records.delete(id);
            }
        });
    }

}

//

type SocketRecord = { id: string, hostname: string, port: number, tls: boolean, conn: Deno.Conn, conn2?: Deno.Conn, writer: WritableStreamDefaultWriter<Uint8Array> }
