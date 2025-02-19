// only import if used
// import { DB, QueryParameter } from 'https://deno.land/x/sqlite@v3.9.1/mod.ts';
// deno-lint-ignore no-explicit-any
type DB = any; type QueryParameter = any;
import { checkMatches, isStringRecord } from '../check.ts';
import { DurableObjectGetAlarmOptions, DurableObjectId, DurableObjectSetAlarmOptions, DurableObjectStorage, DurableObjectStorageListOptions, DurableObjectStorageReadOptions, DurableObjectStorageTransaction, DurableObjectStorageValue, DurableObjectStorageWriteOptions, SqlStorage, SqlStorageCursor, SqlStorageValue } from '../cloudflare_workers_types.d.ts';
import { InMemoryAlarms } from './in_memory_alarms.ts';

export type ComputeDbPathForInstance = (opts: { container: string, className: string, id: string }) => string | Promise<string>;

export class SqliteDurableObjectStorage implements DurableObjectStorage {

    private readonly alarms: InMemoryAlarms;
    private readonly sqlStorage: SqliteSqlStorage;
    readonly db: DB;

    private asyncTransactionDepth = 0;

    constructor(db: DB, dispatchAlarm: () => void) {
        this.db = db;
        this.alarms = new InMemoryAlarms(dispatchAlarm);
        this.sqlStorage = new SqliteSqlStorage(db);
        this.init();
    }

    static async provider(className: string, id: DurableObjectId, options: Record<string, string>, dispatchAlarm: () => void, dbPathForInstance: ComputeDbPathForInstance) {
        const dbPath = await dbPathForInstance({ 
            container: checkMatches('container', options.container || 'default', DB_PATH_TOKEN), 
            className: checkMatches('className', className, DB_PATH_TOKEN),
            id: checkMatches('id', id.toString(), DB_PATH_TOKEN),
        });
        console.log(`new SqliteDurableObjectStorage(${dbPath})`);
        // deno-lint-ignore no-explicit-any
        const globalThisAny = globalThis as any;
        if (!globalThisAny.Deno && globalThisAny._Deno) globalThisAny.Deno = globalThisAny._Deno;
        const { DB } = await import('https://deno.land/x/sqlite@v3.9.1/mod.ts' + '');
        const db = new DB(dbPath);
        return new SqliteDurableObjectStorage(db, dispatchAlarm);
    }

    async transaction<T>(closure: (txn: DurableObjectStorageTransaction) => T | PromiseLike<T>): Promise<T> {
        const txn = new SqliteDurableObjectStorageTransaction(this);
        return await this.asyncTransaction(async () => await closure(txn));
    }

    transactionSync<T>(closure: () => T): T {
        return this.db.transaction(closure);
    }

    sync(): Promise<void> {
        throw new Error(`SqliteDurableObjectStorage.sync() not implemented`);
    }

    deleteAll(): Promise<void> {
        const { db } = this;
        const names = db.query(`select name from sqlite_master where type = 'table' order by name asc`) as [ string ][];
        let dropped = 0;
        for (const [ name ] of names) {
            const skip = name.startsWith('sqlite_');
            if (skip) {
                console.log(`deleteAll: skipping ${name}`);
                continue;
            }
            db.execute(`drop table ${name}`);
            dropped++;
        }
        if (dropped > 0) db.execute('vacuum'); // TODO but will fail in a transaction
        this.init();
        return Promise.resolve();
    }

    get(key: string, opts?: DurableObjectStorageReadOptions): Promise<DurableObjectStorageValue | undefined>;
    get(keys: readonly string[], opts?: DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue>>;
    get(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue> | DurableObjectStorageValue | undefined> {
        return this._get(keyOrKeys, opts); 
    }

    _get(keyOrKeys: string | readonly string[], opts: DurableObjectStorageReadOptions = {}): Promise<Map<string, DurableObjectStorageValue> | DurableObjectStorageValue | undefined> {
        const { ...rest } = opts;
        if (Object.keys(rest).length === 0) {
            if (typeof keyOrKeys === 'string') {
                const rows = this.db.query(`select type, value from ${KV_TABLE} where key = ?`, [ packKey(keyOrKeys) ]) as [ number, string ][];
                for (const [ type, value ] of rows) {
                    return Promise.resolve(unpackValue(type, value));
                }
                return Promise.resolve(undefined);
            } else if (Array.isArray(keyOrKeys)) {
                const rows = this.db.query(`select key, type, value from ${KV_TABLE} where key in (${keyOrKeys.map(_ => '?').join(', ')})`, keyOrKeys.map(packKey)) as [ Uint8Array, number, string ][];
                const rt = new Map<string, DurableObjectStorageValue>();
                for (const [ key, type, value ] of rows) {
                    rt.set(unpackKey(key), unpackValue(type, value));
                }
                return Promise.resolve(rt);
            }
        }
        throw new Error(`SqliteDurableObjectStorage.get(${JSON.stringify({ keyOrKeys, opts })}) not implemented`);
    }
   
    put(key: string, value: DurableObjectStorageValue, opts?: DurableObjectStorageWriteOptions): Promise<void>;
    put(entries: Record<string, unknown>, opts?: DurableObjectStorageWriteOptions): Promise<void>;
    put(arg1: unknown, arg2?: unknown, arg3?: unknown): Promise<void> {
        return this._put(arg1, arg2, arg3);
    }

    _put(arg1: unknown, arg2?: unknown, arg3?: unknown): Promise<void> {
        const { db } = this;
        if (typeof arg1 === 'string') {
            const [ type, packedValue ] = packValue(arg2);
            db.query(`replace into ${KV_TABLE}(key, type, value) values (?, ?, ?)`, [ packKey(arg1), type, packedValue ]);
            return Promise.resolve();
        } else if (isStringRecord(arg1)) {
            db.transaction(() => {
                for (const [ key, value ] of Object.entries(arg1)) {
                    const [ type, packedValue ] = packValue(value);
                    db.query(`replace into ${KV_TABLE}(key, type, value) values (?, ?, ?)`, [ packKey(key), type, packedValue ]);
                }
            });
            return Promise.resolve();
        }
        throw new Error(`SqliteDurableObjectStorage.put(${JSON.stringify({ arg1, arg2, arg3 })}) not implemented`);
    }
   
    delete(key: string, opts?: DurableObjectStorageWriteOptions): Promise<boolean>;
    delete(keys: readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<number>;
    delete(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<boolean | number> {
        return this._delete(keyOrKeys, opts);
    }

    _delete(keyOrKeys: string | readonly string[], opts: DurableObjectStorageWriteOptions = {}): Promise<boolean | number> {
        const { db } = this;
        const { ...rest } = opts;
        if (Object.keys(rest).length === 0) {
            if (typeof keyOrKeys === 'string') {
                const rows = db.query(`delete from ${KV_TABLE} where key = ? returning key`, [ packKey(keyOrKeys) ]);
                return Promise.resolve(rows.length > 0);
            } else if (Array.isArray(keyOrKeys)) {
                const rows = db.query(`delete from ${KV_TABLE} where key in (${keyOrKeys.map(_ => '?').join(', ')}) returning key`, keyOrKeys.map(packKey));
                return Promise.resolve(rows.length);
            }
        }
        throw new Error(`SqliteDurableObjectStorage.delete(${JSON.stringify({ keyOrKeys, opts })}) not implemented`);
    }
   
    list(options: DurableObjectStorageListOptions & DurableObjectStorageReadOptions = {}): Promise<Map<string, DurableObjectStorageValue>> {
        const { limit, reverse, start, startAfter, end, prefix, ...rest } = options;
        if (Object.keys(rest).length > 0) throw new Error(`SqliteDurableObjectStorage.list(${JSON.stringify({ options })}) not implemented`);

        const whereClauses: string[] = [];
        const params: QueryParameter[] = [];
        if (typeof start === 'string') {
            whereClauses.push(`key ${reverse ? '<=' : '>='} ?`);
            params.push(packKey(start));
        }
        if (typeof startAfter === 'string') {
            whereClauses.push(`key ${reverse ? '<' : '>'} ?`);
            params.push(packKey(startAfter));
        }
        if (typeof end === 'string') {
            whereClauses.push(`key ${reverse ? '>' : '<'} ?`);
            params.push(packKey(end));
        }
        if (typeof prefix === 'string' && prefix.length > 0) {
            const prefixBytes = packKey(prefix);
            whereClauses.push(`substr(key, 1, ${prefixBytes.length}) = ?`);
            params.push(prefixBytes);
        }

        const q = `select key, type, value from ${KV_TABLE}${whereClauses.length > 0 ? ` where ${whereClauses.join(' and ')}` : ''} order by key ${reverse ? 'desc' : 'asc'}${typeof limit === 'number' ? ` limit ${limit}` : ''}`;
        const rows = this.db.query(q, params) as [ Uint8Array, number, string][];
        const rt = new Map<string, DurableObjectStorageValue>();
        for (const [ keyBlob, type, valueBlob ] of rows) {
            rt.set(unpackKey(keyBlob), unpackValue(type, valueBlob));
        }
        return Promise.resolve(rt);
    }

    getAlarm(options?: DurableObjectGetAlarmOptions): Promise<number | null> {
        return this.alarms.getAlarm(options);
    }

    setAlarm(scheduledTime: number | Date, options?: DurableObjectSetAlarmOptions): Promise<void> {
        return this.alarms.setAlarm(scheduledTime, options);
    }
    
    deleteAlarm(options?: DurableObjectSetAlarmOptions): Promise<void> {
        return this.alarms.deleteAlarm(options);
    }

    getBookmarkForTime(timestamp: number | Date): Promise<string> {
        throw new Error(`SqliteDurableObjectStorage.getBookmarkForTime(${JSON.stringify({ timestamp })}) not implemented`);
    }

    getCurrentBookmark(): Promise<string> {
        throw new Error(`SqliteDurableObjectStorage.getCurrentBookmark() not implemented`);
    }

    onNextSessionRestoreBookmark(bookmark: string): Promise<string> {
        throw new Error(`SqliteDurableObjectStorage.onNextSessionRestoreBookmark(${JSON.stringify({ bookmark })}) not implemented`);
    }

    get sql(): SqlStorage {
        return this.sqlStorage;
    }

    //

    private init() {
        this.db.execute(`create table if not exists ${KV_TABLE}(key blob primary key, type integer not null, value text not null) without rowid`);
    }

    private async asyncTransaction<V>(closure: () => Promise<V>): Promise<V> {
        this.asyncTransactionDepth += 1;
        this.db.execute(`SAVEPOINT _denoflare_sqlite_sp_${this.asyncTransactionDepth}`);
        try {
            return await closure();
        } catch (err) {
            this.db.execute(`ROLLBACK TO _denoflare_sqlite_sp_${this.asyncTransactionDepth}`);
            throw err;
        } finally {
            this.db.execute(`RELEASE _denoflare_sqlite_sp_${this.asyncTransactionDepth}`);
            this.asyncTransactionDepth -= 1;
        }
    }

}

//

const DB_PATH_TOKEN = /^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$/;
const KV_TABLE = `_cf_KV`;

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function unpackKey(packed: Uint8Array): string {
    return decoder.decode(packed);
}

function packKey(key: string): Uint8Array {
    return encoder.encode(key);
}

function unpackValue(type: number, packed: string): DurableObjectStorageValue {
    if (type === 1) return undefined as unknown as DurableObjectStorageValue;
    if (type === 2) return null as unknown as DurableObjectStorageValue;
    if (type === 3) return packed;
    if (type === 4) return parseInt(packed);
    if (type === 5) return JSON.parse(packed);
    throw new Error(`unpackValue: Unsupported type: ${type}`);
}

function packValue(value: unknown): [ number, string ] {
    if (value === undefined) return [ 1, '' ];
    if (value === null) return [ 2, '' ];
    if (typeof value === 'string') return [ 3, value ];
    if (typeof value === 'number') {
        if (Number.isSafeInteger(value)) return [ 4, value.toString() ];
    }
    if (typeof value === 'object' && isSafeJson(value)) return [ 5, JSON.stringify(value) ];
    throw new Error(`packValue: Unsupported value: ${typeof value} ${value}${typeof value === 'object' ? ` ${value.constructor.name}` : ''}`);
}

function isSafeJson(value: unknown): boolean {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isSafeInteger(value);
    if (typeof value === 'object') return isStringRecord(value) && Object.values(value).every(isSafeJson);
    return false;
}

//

class SqliteDurableObjectStorageTransaction implements DurableObjectStorageTransaction {
    private readonly storage: SqliteDurableObjectStorage;

    constructor(storage: SqliteDurableObjectStorage) {
        this.storage = storage;
    }

    rollback() {
        throw new Error(`SqliteDurableObjectStorageTransaction.rollback() not implemented`);
    }

    deleteAll(): Promise<void> {
        return this.storage.deleteAll();
    }

    get(key: string, opts?: DurableObjectStorageReadOptions): Promise<DurableObjectStorageValue | undefined>;
    get(keys: readonly string[], opts?: DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue>>;
    get(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue> | DurableObjectStorageValue | undefined> {
        return this.storage._get(keyOrKeys, opts);
    }

    put(key: string, value: DurableObjectStorageValue, opts?: DurableObjectStorageWriteOptions): Promise<void>;
    put(entries: Record<string, unknown>, opts?: DurableObjectStorageWriteOptions): Promise<void>;
    put(arg1: unknown, arg2?: unknown, arg3?: unknown): Promise<void> {
        return this.storage._put(arg1, arg2, arg3);
    }

    delete(key: string, opts?: DurableObjectStorageWriteOptions): Promise<boolean>;
    delete(keys: readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<number>;
    delete(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<boolean | number> {
        return this.storage._delete(keyOrKeys, opts);
    }

    list(options: DurableObjectStorageListOptions & DurableObjectStorageReadOptions = {}): Promise<Map<string, DurableObjectStorageValue>> {
        return this.storage.list(options);
    }

    getAlarm(options?: DurableObjectGetAlarmOptions): Promise<number | null> {
        return this.storage.getAlarm(options);
    }

    setAlarm(scheduledTime: number | Date, options?: DurableObjectSetAlarmOptions): Promise<void> {
        return this.storage.setAlarm(scheduledTime, options);
    }
    
    deleteAlarm(options?: DurableObjectSetAlarmOptions): Promise<void> {
        return this.storage.deleteAlarm(options);
    }
    
}

class SqliteSqlStorage implements SqlStorage {
    private readonly db: DB;

    constructor(db: DB) {
        this.db = db;
    }

    exec<T extends Record<string, SqlStorageValue>>(query: string, ...bindings: unknown[]): SqlStorageCursor<T> {
        return new SqliteSqlStorageCursor(this.db, query, bindings);
    }

    get databaseSize(): number {
        const [ [ size ] ] = this.db.query(`select page_count * page_size from pragma_page_count(), pragma_page_size()`) as [ number ][];
        return size;
    }

}

class SqliteSqlStorageCursor<T extends Record<string, SqlStorageValue>> implements SqlStorageCursor<T> {

    private readonly db: DB;
    private readonly query: string;
    private readonly bindings: unknown[];

    private readonly columns: string[] = [];
    private readonly rows: unknown[][] = [];
    private nextRowIndex = -1;

    constructor(db: DB, query: string, bindings: unknown[]) {
        this.db = db;
        this.query = query;
        this.bindings = bindings;
    }

    next(): { done?: false; value: T; } | { done: true; value?: never; } {
        this.executeIfNecessary();
        const { rows, columns } = this;
        if (this.nextRowIndex >= rows.length) return { done: true };
        const row = rows[this.nextRowIndex++];
        if (row.length !== columns.length) throw new Error();
        return { done: false, value: Object.fromEntries(columns.map((v, i) => [ v, row[i] ])) as T };
    }

    toArray(): T[] {
        this.executeIfNecessary();
        const rt: T[] = [];
        while (true) {
            const result = this.next();
            if (result.done) return rt;
            rt.push(result.value);
        }
    }

    one(): T {
        this.executeIfNecessary();
        const arr = this.toArray();
        if (arr.length === 0) throw new Error('Expected exactly one result from SQL query, but got no results.');
        if (arr.length > 1) throw new Error('Expected exactly one result from SQL query, but got multiple results.');
        return arr[0];
    }

    raw<U extends SqlStorageValue[]>(): IterableIterator<U> & { toArray(): U[]; } {
        this.executeIfNecessary();
        const { rows } = this;
        // deno-lint-ignore no-this-alias
        const thiz = this;
        return {
            next(): IteratorResult<U> {
                if (thiz.nextRowIndex >= rows.length) return { done: true } as IteratorResult<U>;
                const row = rows[thiz.nextRowIndex++];
                return { done: false, value: row } as IteratorResult<U>;
            },
            [Symbol.iterator](): IterableIterator<U> {
                return this;
            },
            toArray(): U[] {
                const rt: U[] = [];
                while (true) {
                    const result = this.next();
                    if (result.done) return rt;
                    rt.push(result.value);
                }
            },
        }
    }

    get columnNames(): string[] {
        this.executeIfNecessary();
        return [ ...this.columns ];
    }

    get rowsRead(): number {
        this.executeIfNecessary();
        return this.nextRowIndex;
    }

    get rowsWritten(): number {
        this.executeIfNecessary();
        return 0; // TODO how?
    }

    [Symbol.iterator](): IterableIterator<T> {
        this.executeIfNecessary();
        // deno-lint-ignore no-this-alias
        const thiz = this;
        return {
            next(): IteratorResult<T> {
                return thiz.next() as IteratorResult<T>;
            },
            [Symbol.iterator](): IterableIterator<T> {
                return this;
            }
        }
    }

    //

    private executeIfNecessary() {
        if (this.nextRowIndex >= 0) return;

        // read all values immediately for now so we can finalize the pq
        const pq = this.db.prepareQuery(this.query);
        try {
            this.columns.push(...(pq.columns() as { name: string}[]).map(v => v.name));
            const iter = pq.iter(this.bindings.map(v => { 
                if (!isQueryParameter(v)) throw new Error(`Unsupported query parameter: ${v}`);
                return v;
            }));
            for (const row of iter) {
                this.rows.push(row);
            }
            this.nextRowIndex = 0;
        } finally {
            pq.finalize();
        }
    }

}

function isQueryParameter(obj: unknown): obj is QueryParameter {
    return typeof obj === 'boolean' || typeof obj === 'number' || typeof obj === 'bigint' || typeof obj === 'string' || obj === null || obj === undefined 
        || (typeof obj === 'object' && (obj instanceof Date || obj instanceof Uint8Array));
}
