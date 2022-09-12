import { RpcChannel } from '../common/rpc_channel.ts';
import { makeRpcStubDurableObjectStorageProvider } from '../common/rpc_stub_durable_object_storage.ts';
import { runSimpleStorageTestScenario } from '../common/storage/durable_object_storage_test.ts';
import { makeRpcHostDurableObjectStorage } from './rpc_host_durable_object_storage.ts';

Deno.test('makeRpcHostDurableObjectStorage', async () => {
    const channels = new InMemoryRpcChannels('test');
    makeRpcHostDurableObjectStorage(channels.host);
    const provider = makeRpcStubDurableObjectStorageProvider(channels.stub);
    const storage = provider('class1', 'id1', { storage: 'memory', container: 'test.rpc' }, () => {});
    await runSimpleStorageTestScenario(storage);
});

//

class InMemoryRpcChannels {
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
