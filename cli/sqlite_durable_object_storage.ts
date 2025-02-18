// only import if used
// import { DenoDir } from 'https://esm.sh/jsr/@deno/cache-dir@0.11.1';
// import { DB, QueryParameter } from 'https://deno.land/x/sqlite@v3.8/mod.ts';
// deno-lint-ignore no-explicit-any
type DB = any;
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
    }

    static async provider(className: string, id: DurableObjectId, options: Record<string, string>, dispatchAlarm: () => void, dbPathForInstance: ComputeDbPathForInstance = SqliteDurableObjectStorage.defaultDbPathForInstance) {
        const dbPath = await dbPathForInstance({ container: options.container || 'default', className, id: id.toString() });
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
        throw new Error(`SqliteDurableObjectStorage.deleteAll() not implemented`);
    }

    get(key: string, opts?: DurableObjectStorageReadOptions): Promise<DurableObjectStorageValue | undefined>;
    get(keys: readonly string[], opts?: DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue>>;
    get(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue> | DurableObjectStorageValue | undefined> {
        return this._get(keyOrKeys, opts); 
    }

    _get(keyOrKeys: string | readonly string[], opts: DurableObjectStorageReadOptions = {}): Promise<Map<string, DurableObjectStorageValue> | DurableObjectStorageValue | undefined> {
        throw new Error(`SqliteDurableObjectStorage.get(${JSON.stringify({ keyOrKeys, opts })}) not implemented`);
    }
   
    put(key: string, value: DurableObjectStorageValue, opts?: DurableObjectStorageWriteOptions): Promise<void>;
    put(entries: Record<string, unknown>, opts?: DurableObjectStorageWriteOptions): Promise<void>;
    put(arg1: unknown, arg2?: unknown, arg3?: unknown): Promise<void> {
        return this._put(arg1, arg2, arg3);
    }

    _put(arg1: unknown, arg2?: unknown, arg3?: unknown): Promise<void> {
        throw new Error(`SqliteDurableObjectStorage.put(${JSON.stringify({ arg1, arg2, arg3 })}) not implemented`);
    }
   
    delete(key: string, opts?: DurableObjectStorageWriteOptions): Promise<boolean>;
    delete(keys: readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<number>;
    delete(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<boolean | number> {
        return this._delete(keyOrKeys, opts);
    }

    _delete(keyOrKeys: string | readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<boolean | number> {
        throw new Error(`SqliteDurableObjectStorage.delete(${JSON.stringify({ keyOrKeys, opts })}) not implemented`);
    }
   
    async list(options: DurableObjectStorageListOptions & DurableObjectStorageReadOptions = {}): Promise<Map<string, DurableObjectStorageValue>> {
        throw new Error(`SqliteDurableObjectStorage.list(${JSON.stringify({ options })}) not implemented`);
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
        const [ [ size ] ] = this.storage.db.query(`select page_count * page_size from pragma_page_count(), pragma_page_size()`);
        return size;
    }

}
