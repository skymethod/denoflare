import { InMemoryDurableObjectStorage } from './in_memory_durable_object_storage.ts';
import { assertEquals } from 'https://deno.land/std@0.114.0/testing/asserts.ts';

Deno.test('Simple storage test scenario', async () => {
    const storage = new InMemoryDurableObjectStorage();
    assertEquals((await storage.list()).size, 0);
    assertEquals(await storage.get('foo'), undefined);
    await storage.put('foo', 'bar');
    assertEquals(await storage.get('foo'), 'bar');
    assertEquals((await storage.list()).size, 1);
    await storage.put('foo', 'baz');
    assertEquals((await storage.list()).size, 1);
    assertEquals(await storage.get('foo'), 'baz');
    await storage.put('foo2', 'bar');
    assertEquals((await storage.list()).size, 2);
    assertEquals(await storage.delete('bad'), false);
    assertEquals((await storage.list()).size, 2);
    assertEquals(await storage.delete('foo'), true);
    assertEquals((await storage.list()).size, 1);
    await storage.deleteAll();
    assertEquals((await storage.list()).size, 0);
});
