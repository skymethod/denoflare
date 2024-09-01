import { makeRpcStubDurableObjectStorageProvider } from '../common/rpc_stub_durable_object_storage.ts';
import { runSimpleStorageTestScenario } from '../common/storage/durable_object_storage_test.ts';
import { InMemoryRpcChannels } from './in_memory_rpc_channels.ts';
import { makeRpcHostDurableObjectStorage } from './rpc_host_durable_object_storage.ts';

Deno.test('makeRpcHostDurableObjectStorage', async () => {
    const channels = new InMemoryRpcChannels('test');
    makeRpcHostDurableObjectStorage(channels.host);
    const provider = makeRpcStubDurableObjectStorageProvider(channels.stub);
    const storage = provider('class1', 'id1', { storage: 'memory', container: 'test.rpc' }, () => {});
    await runSimpleStorageTestScenario(storage);
});
