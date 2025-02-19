// only import if used
// import { DenoDir } from 'https://esm.sh/jsr/@deno/cache-dir@0.11.1';
// import { DB, QueryParameter } from 'https://deno.land/x/sqlite@v3.9.1/mod.ts';
// deno-lint-ignore no-explicit-any
type DB = any;
import { D1Database, D1ExecResult, D1PreparedStatement, D1QueryMetadata, D1Result } from '../common/cloudflare_workers_types.d.ts';
import { D1DatabaseProvider } from '../common/cloudflare_workers_runtime.ts';
import { join } from './deps_cli.ts';

type ComputeDbPathForDatabase = (d1DatabaseUuid: string) => string | Promise<string>;

export class SqliteD1Database implements D1Database {
    private readonly d1DatabaseUuid: string;
    private readonly dbPathForDatabase: ComputeDbPathForDatabase;

    private db: DB | undefined;
    private dbPath: string | undefined;
    
    private constructor(d1DatabaseUuid: string, dbPathForDatabase: ComputeDbPathForDatabase) {
        this.d1DatabaseUuid = d1DatabaseUuid;
        this.dbPathForDatabase = dbPathForDatabase;
    }

    prepare(query: string): D1PreparedStatement {
        return new SqliteD1PreparedStatement({ 
            query, 
            dbProvider: async () => await this.getOrOpenDb(), 
            sizeProvider: async () => await this.getDBSizeInBytes(),
            params: undefined,
        });
    }

    dump(): Promise<ArrayBuffer> {
        throw new Error(`dump() not implemented`);
    }

    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
        const db = await this.getOrOpenDb();
        const rt: D1Result<T>[] = [];
        db.transaction(() => {
            for (const statement of statements) {
                const result = (statement as SqliteD1PreparedStatement).runSync<T>(db);
                rt.push(result);
            }
        });
        const sizeAfter = await this.getDBSizeInBytes();
        // deno-lint-ignore no-explicit-any
        rt.forEach(v => (v.meta as any).size_after = sizeAfter);
        return rt;
    }

    async exec(query: string): Promise<D1ExecResult> {
        const start = Date.now();
        const db = await this.getOrOpenDb();
        let count = 0;
        for (let line of query.split('\n')) {
            line = line.trim();
            while (line.endsWith(';')) line = line.substring(0, line.length - 1).trim();
            if (line === '') continue;
            db.execute(line);
            count++;
        }
        return { count, duration: Date.now() - start };
    }

    close() {
        this.db?.close(true);
    }

    static provider(dbPathForDatabase?: ComputeDbPathForDatabase): D1DatabaseProvider {
        return d1DatabaseUuid => new SqliteD1Database(d1DatabaseUuid, dbPathForDatabase ?? SqliteD1Database.defaultDbPathForDatabase);
    }

    static async defaultDbPathForDatabase(d1DatabaseUuid: string): Promise<string> {
        const { DenoDir } = await import('https://esm.sh/jsr/@deno/cache-dir@0.11.1' + '');
        const root = DenoDir.tryResolveRootPath(undefined);
        if (root === undefined) throw new Error(`Unable to resolve deno cache dir`);
        const denoflareD1Dir = join(root, 'denoflare', 'd1');
        await Deno.mkdir(denoflareD1Dir, { recursive: true });
        return join(denoflareD1Dir, `${d1DatabaseUuid}.db`);
    }

    //

    private async getOrOpenDb(): Promise<DB> {
        if (this.db) return this.db;

        const { d1DatabaseUuid, dbPathForDatabase } = this;
        const { DB } = await import('https://deno.land/x/sqlite@v3.9.1/mod.ts' + '');
        const dbPath = await dbPathForDatabase(d1DatabaseUuid);
        console.log(`SqliteD1Database: opening ${dbPath}`);
        const db = new DB(dbPath);
        this.db = db;
        this.dbPath = dbPath;
        return db;
    }

    private async getDBSizeInBytes(): Promise<number> {
        const { dbPath } = this;
        if (typeof dbPath !== 'string') throw new Error(`Cannot get size before db is opened`);
        if (dbPath === ':memory:') return 0;
        const stat = await Deno.stat(dbPath);
        return stat.size;
    }

}

//

function convertBindParamToQueryParameter(obj: unknown, index: number): unknown {
    // https://developers.cloudflare.com/d1/build-with-d1/d1-client-api/#type-conversion
    if (obj === null || typeof obj === 'number' || typeof obj === 'string') return obj;
    if (obj === true) return 1;
    if (obj === false) return 0;
    if (typeof obj === 'object' && obj instanceof ArrayBuffer) return new Uint8Array(obj);
    throw new Error(`Unsupported bind param at index ${index}: ${obj}`);
}

//

class SqliteD1PreparedStatement implements D1PreparedStatement {
    private readonly query: string;
    private readonly dbProvider: () => Promise<DB>;
    private readonly sizeProvider: () => Promise<number>;
    private readonly params?: unknown[];

    constructor({ query, dbProvider, sizeProvider, params }: { query: string, dbProvider: () => Promise<DB>, sizeProvider: () => Promise<number>, params: unknown[] | undefined }) {
        this.query = query;
        this.dbProvider = dbProvider;
        this.sizeProvider = sizeProvider;
        this.params = params;
    }

    bind(...values: unknown[]): D1PreparedStatement {
        const { query, dbProvider, sizeProvider } = this;
        const params =  values.map(convertBindParamToQueryParameter);
        return new SqliteD1PreparedStatement({ query, dbProvider, sizeProvider, params });
    }

    first<T = unknown>(column: string): Promise<T | null>;
    first<T = Record<string, unknown>>(): Promise<T | null>;
    async first<T>(column?: string): Promise<T | null> {
        const { dbProvider, query, params } = this;
        const db = await dbProvider();
        const pq = db.prepareQuery(query);
        try {
            for (const row of pq.iterEntries(params)) {
                return (column ? row[column] : row) as T;
            }
            return null;
        } finally {
            pq.finalize();
        }
    }

    async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        return await this.run();
    }

    async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        const { dbProvider, query, params, sizeProvider } = this;
        const start = Date.now();
        const db = await dbProvider();
        const pq = db.prepareQuery(query);
        try {
            const results: T[] = [];
            for (const row of pq.iterEntries(params)) {
                results.push(row as T);
            }
            const meta = newMeta(query, db, start, await sizeProvider());
            return { success: true, meta, results };
        } finally {
            pq.finalize();
        }
    }

    raw<T = unknown[]>(options: { columnNames: true }): Promise<[ string[], ...T[] ]>;
    raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
    async raw<T = unknown[]>({ columnNames = false }: { columnNames?: boolean } = {}): Promise<T[] | [ string[], ...T[] ]> {
        const { dbProvider, query, params } = this;
        const db = await dbProvider();
        const pq = db.prepareQuery(query);
        try {
            const rt: unknown[][] = [];
            if (columnNames) {
                rt.push(pq.columns().map((v: { name: string }) => v.name));
            }
            for (const row of pq.iter(params)) {
                rt.push(row);
            }
            return rt as T[];
        } finally {
            pq.finalize();
        }
    }

    //

    runSync<T = Record<string, unknown>>(db: DB): D1Result<T> {
        const { query, params } = this;
        const start = Date.now();
        const pq = db.prepareQuery(query);
        try {
            const results: T[] = [];
            for (const row of pq.iterEntries(params)) {
                results.push(row as T);
            }
            const meta = newMeta(query, db, start, 0);
            return { success: true, meta, results };
        } finally {
            pq.finalize();
        }
    }

}

function newMeta(query: string, db: DB, start: number, sizeAfter: number): D1QueryMetadata & Record<string, unknown> {
    const changed_db = /^(create|drop|insert|update|delete|replace)\s+/i.test(query.trim());
    return {
        changed_db,
        changes: changed_db ? db.changes : 0,
        duration: Date.now() - start,
        last_row_id: db.lastInsertRowId,
        rows_read: 0,
        rows_written: 0,
        size_after: sizeAfter,
        served_by: 'denoflare'
    }
}
