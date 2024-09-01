import { makeRpcStubD1DatabaseProvider } from '../common/rpc_stub_d1_database.ts';
import { InMemoryRpcChannels } from './in_memory_rpc_channels.ts';
import { makeRpcHostD1Database } from './rpc_host_d1_database.ts';
import { SqliteD1Database } from './sqlite_d1_database.ts';
import { runSimpleD1DatabaseScenario } from './sqlite_d1_database_test.ts';

Deno.test({
    name: 'makeRpcHostD1Database',
    ignore: (await Deno.permissions.query({ name: 'net' })).state !== 'granted',
    async fn() {
        const channels = new InMemoryRpcChannels('test');
        makeRpcHostD1Database(channels.host, v => SqliteD1Database.provider(() => ':memory:')(v));
        const provider = makeRpcStubD1DatabaseProvider(channels.stub);
        const db = provider(crypto.randomUUID())
        await runSimpleD1DatabaseScenario(db);
    }
});
