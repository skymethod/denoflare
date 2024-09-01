import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { SqliteD1Database } from './sqlite_d1_database.ts';
import { assert } from 'https://deno.land/std@0.224.0/assert/assert.ts';

Deno.test({
    name: 'SqliteD1Database',
    ignore: (await Deno.permissions.query({ name: 'net' })).state !== 'granted',
    async fn() {
        const db = SqliteD1Database.provider(() => ':memory:')(crypto.randomUUID()) as SqliteD1Database;
        await db.prepare('create table t1(id int primary key, name text)').all();
        {
            const result = await db.prepare(`insert into t1(id, name) values(1, 'one')`).all();
            assert(result.success);
            assert(result.meta.changed_db);
            assertEquals(result.meta.changes, 1);
            assertEquals(result.results, []);
        }
        {
            const result = await db.prepare(`select * from t1`).all();
            assert(result.success);
            assert(!result.meta.changed_db);
            assertEquals(result.meta.changes, 0);
            assertEquals(result.results, [ { id: 1, name: 'one' } ]);
        }
        {
            const result = await db.prepare(`select * from t1`).raw();
            assertEquals(result, [ [ 1, 'one' ] ]);
        }
        {
            const result = await db.prepare(`select * from t1`).raw({ columnNames: true });
            assertEquals(result, [ [ 'id', 'name' ], [ 1, 'one' ] ]);
        }
        {
            const result = await db.prepare(`select * from t1`).first();
            assertEquals(result, { id: 1, name: 'one' });
        }
        {
            const result = await db.prepare(`select * from t1`).first('id');
            assertEquals(result, 1);
        }
        {
            const stmt = db.prepare(`insert into t1(id, name) values(?, ?)`);
            const result = await db.batch([ stmt.bind(2, 'two'), stmt.bind(3, 'three') ]);
            assertEquals(result.length, 2);
            const [ first, second ] = result;
            assertEquals(first.meta.last_row_id, 2);
            assertEquals(second.meta.last_row_id, 3);
        }
        {
            const result = await db.prepare(`select count(*) c from t1`).first('c');
            assertEquals(result, 3);
        }
        {
            const result = await db.exec(`delete from t1\nselect * from sqlite_schema;\nselect * from sqlite_schema ;\r\n`);
            assertEquals(result.count, 3);
        }
        db.close();
    }
});

