import { runSimpleStorageTestScenario } from './durable_object_storage_test.ts';
import { SqliteDurableObjectStorage } from './sqlite_durable_object_storage.ts';

Deno.test({
    name: 'SqliteDurableObjectStorage',
    ignore: (await Deno.permissions.query({ name: 'net' })).state !== 'granted',
    async fn() {
        const storage = await SqliteDurableObjectStorage.provider('class1', 'id1', {}, () => {}, () => ':memory:');
        await runSimpleStorageTestScenario(storage);
    }
});
