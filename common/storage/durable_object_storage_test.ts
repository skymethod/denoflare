import { InMemoryDurableObjectStorage } from './in_memory_durable_object_storage.ts';
import { assertEquals } from 'https://deno.land/std@0.198.0/testing/asserts.ts';
import { DurableObjectStorage } from '../cloudflare_workers_types.d.ts';
import { WebStorageDurableObjectStorage } from './web_storage_durable_object_storage.ts';

Deno.test('InMemoryDurableObjectStorage', async () => {
    const storage = new InMemoryDurableObjectStorage();
    await runSimpleStorageTestScenario(storage);
});

Deno.test('WebStorageDurableObjectStorage', async () => {
    const container = 'test';
    const storage = new WebStorageDurableObjectStorage(container, () => {});
    await runSimpleStorageTestScenario(storage);
});

//

export async function runSimpleStorageTestScenario(storage: DurableObjectStorage) {
    await storage.deleteAll();
    assertEquals((await storage.list()).size, 0);
    assertEquals(await storage.get('foo'), undefined);
    await storage.put('foo', 'bar');
    assertEquals(await storage.get('foo'), 'bar');
    assertEquals((await storage.list()).size, 1);
    await storage.put('foo', 'baz');
    assertEquals((await storage.list()).size, 1);
    assertEquals(await storage.get('foo'), 'baz');
    await storage.put('foo2', 'bar');
    let results = await storage.list();
    assertEquals(results.size, 2);
    assertEquals(results.get('foo'), 'baz');
    assertEquals(results.get('foo2'), 'bar');
    results = await storage.get([ 'foo', 'foo2' ]);
    assertEquals(results.size, 2);
    assertEquals(results.get('foo'), 'baz');
    assertEquals(results.get('foo2'), 'bar');
    await storage.put({ foo2: 'bar2', foo3: 'bar' });
    results = await storage.list();
    assertEquals(results.size, 3);
    assertEquals(results.get('foo2'), 'bar2');
    assertEquals(results.get('foo3'), 'bar');
    assertEquals(await storage.delete('bad'), false);
    assertEquals((await storage.list()).size, 3);
    assertEquals(await storage.delete('foo'), true);
    assertEquals((await storage.list()).size, 2);
    assertEquals(await storage.delete(['bad1', 'bad2']), 0);
    await storage.put('number', 123);
    assertEquals(await storage.get('number'), 123);
    const o1 = { a: true };
    await storage.put('object', o1);
    o1.a = false;
    assertEquals(await storage.get('object'), { a: true });
    await storage.deleteAll();
    assertEquals((await storage.list()).size, 0);

    // list options
    await storage.put('a', '');
    await storage.put('b', '');
    await storage.put('c', '');
    assertEquals((await storage.list()).size, 3);
    assertEquals((await storage.list({ limit: 1 })), new Map([['a', '']]));
    assertEquals((await storage.list({ limit: 1, reverse: true })), new Map([['c', '']]));
    assertEquals((await storage.list({ start: 'c' })), new Map([['c', '']]));
    assertEquals((await storage.list({ startAfter: 'b' })), new Map([['c', '']]));
    assertEquals((await storage.list({ end: 'b' })), new Map([['a', '']]));
    assertEquals((await storage.list({ reverse: true, start: 'b' })), new Map([['b', ''], ['a', '']]));
    assertEquals((await storage.list({ reverse: true, startAfter: 'b' })), new Map([['a', '']]));

    await storage.put('aa', '');
    await storage.put('ab', '');
    await storage.put('ac', '');
    assertEquals((await storage.list({ prefix: 'a' })).size, 4);
    assertEquals((await storage.list({ prefix: 'b' })).size, 1);

    await storage.deleteAll();
    assertEquals((await storage.list()).size, 0);
}
