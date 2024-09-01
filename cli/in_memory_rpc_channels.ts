import { RpcChannel } from '../common/rpc_channel.ts';

export class InMemoryRpcChannels {
    readonly host: RpcChannel;
    readonly stub: RpcChannel;

    constructor(tagBase: string) {
        this.host = new RpcChannel(`${tagBase}-host`, async (message, _transfer) => { 
            await this.stub.receiveMessage(message);
        });
        this.stub = new RpcChannel(`${tagBase}-stub`, async (message, _transfer) => { 
            await this.host.receiveMessage(message);
        });
    }
}
