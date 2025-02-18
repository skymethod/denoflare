// only import if used
// import { DenoDir } from 'https://esm.sh/jsr/@deno/cache-dir@0.11.1';
// import { DB, QueryParameter } from 'https://deno.land/x/sqlite@v3.8/mod.ts';
// deno-lint-ignore no-explicit-any
type DB = any; type QueryParameter = any;
import { checkMatches, isStringRecord } from '../common/check.ts';
import { DurableObjectGetAlarmOptions, DurableObjectId, DurableObjectSetAlarmOptions, DurableObjectStorage, DurableObjectStorageListOptions, DurableObjectStorageReadOptions, DurableObjectStorageTransaction, DurableObjectStorageValue, DurableObjectStorageWriteOptions, SqlStorage, SqlStorageCursor, SqlStorageValue } from '../common/cloudflare_workers_types.d.ts';
import { InMemoryAlarms } from '../common/storage/in_memory_alarms.ts';
import { join } from './deps_cli.ts';

export type ComputeDbPathForInstance = (opts: { container: string, className: string, id: string }) => string | Promise<string>;

export class SqliteDurableObjectStorage implements DurableObjectStorage {

    private readonly alarms: InMemoryAlarms;
    private readonly sqlStorage: SqliteSqlStorage;
    
    readonly db: DB;

    constructor(db: DB, dispatchAlarm: () => void) {
        this.db = db;
        this.alarms = new InMemoryAlarms(dispatchAlarm);
        this.sqlStorage = new SqliteSqlStorage(this);
        this.init();
    }

    static async provider(className: string, id: DurableObjectId, options: Record<string, string>, dispatchAlarm: () => void, dbPathForInstance: ComputeDbPathForInstance = SqliteDurableObjectStorage.defaultDbPathForInstance) {
        const dbPath = await dbPathForInstance({ 
            container: checkMatches('container', options.container || 'default', DB_PATH_TOKEN), 
            className: checkMatches('className', className, DB_PATH_TOKEN),
            id: checkMatches('id', id.toString(), DB_PATH_TOKEN),
        });
        console.log(`new SqliteDurableObjectStorage(${dbPath})`);
        const { DB } = await import('https://deno.land/x/sqlite@v3.8/mod.ts' + '');
        const db = new DB(dbPath);
        return new SqliteDurableObjectStorage(db, dispatchAlarm);
    }

    static async defaultDbPathForInstance({ container, className, id }: { container: string, className: string, id: string }): Promise<string> {
        const { DenoDir } = await import('https://esm.sh/jsr/@deno/cache-dir@0.11.1' + '');
        const root = DenoDir.tryResolveRootPath(undefined);
        if (root === undefined) throw new Error(`Unable to resolve deno cache dir`);
        const denoflareDosqlDir = join(root, 'denoflare', 'dosql');
        await Deno.mkdir(denoflareDosqlDir, { recursive: true });
        return join(denoflareDosqlDir, `${container}-${className}-${id}.db`);
    }

    async transaction<T>(closure: (txn: DurableObjectStorageTransaction) => T | PromiseLike<T>): Promise<T> {
        const txn = new SqliteDurableObjectStorageTransaction(this);
        return await Promise.resolve(closure(txn));
    }

    sync(): Promise<void> {
        throw new Error(`SqliteDurableObjectStorage.sync() not implemented`);
    }

    deleteAll(): Promise<void> {
        const { db } = this;
        const names = db.query(`select name from sqlite_master where type = 'table' order by name asc`) as [ string ][];
        for (const [ name ] of names) {
            const skip = name.startsWith('sqlite_');
            if (skip) {
                console.log(`deleteAll: skipping ${name}`);
                continue;
            }
            db.execute(`drop table ${name}`);
        }
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

    transactionSync<T>(closure: () => T): T {
        throw new Error(`SqliteDurableObjectStorage.transactionSync(${JSON.stringify({ closure })}) not implemented`);
    }

    get sql(): SqlStorage {
        return this.sqlStorage;
    }

    //

    private init() {
        this.db.execute(`create table if not exists ${KV_TABLE}(key blob primary key, type integer not null, value text not null) without rowid`);
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
    private readonly storage: SqliteDurableObjectStorage;

    constructor(storage: SqliteDurableObjectStorage) {
        this.storage = storage;
    }

    exec<T extends Record<string, SqlStorageValue>>(query: string, ...bindings: unknown[]): SqlStorageCursor<T> {
        throw new Error(`SqliteSqlStorage.exec(${JSON.stringify({ query, bindings })}) not implemented`);
    }

    get databaseSize(): number {
        const [ [ size ] ] = this.storage.db.query(`select page_count * page_size from pragma_page_count(), pragma_page_size()`) as [ number ][];
        return size;
    }

}
