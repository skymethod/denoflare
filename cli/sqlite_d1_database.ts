// only import if used
// import { DenoDir } from 'https://esm.sh/jsr/@deno/cache-dir@0.11.1';
// import { DB, QueryParameter } from 'https://deno.land/x/sqlite@v3.8/mod.ts';
// deno-lint-ignore no-explicit-any
type DB = any;
import { D1Database, D1ExecResult, D1PreparedStatement, D1QueryMetadata, D1Result } from '../common/cloudflare_workers_types.d.ts';
import { D1DatabaseProvider } from '../common/cloudflare_workers_runtime.ts';
import { join } from './deps_cli.ts';

export class SqliteD1Database implements D1Database {
    private readonly d1DatabaseUuid: string;

    private db: DB | undefined;
    private dbPath: string | undefined;
    
    private constructor(d1DatabaseUuid: string) {
        this.d1DatabaseUuid = d1DatabaseUuid;
    }

    prepare(query: string): D1PreparedStatement {
        const { d1DatabaseUuid } = this;
        return new SqliteD1PreparedStatement({ 
            query, 
            d1DatabaseUuid, 
            dbProvider: async () => await this.getOrOpenDb(), 
            sizeProvider: async () => await this.getDBSizeInBytes(),
        });
    }

    dump(): Promise<ArrayBuffer> {
        throw new Error(`dump() not implemented`);
    }

    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
        throw new Error(`batch(${JSON.stringify({ statements })}) not implemented`);
    }

    exec(query: string): Promise<D1ExecResult> {
        throw new Error(`exec(${JSON.stringify({ query })}) not implemented`);
    }

    static provider: D1DatabaseProvider = d1DatabaseUuid => new SqliteD1Database(d1DatabaseUuid);

    //

    private async getOrOpenDb(): Promise<DB> {
        if (this.db) return this.db;

        const { d1DatabaseUuid } = this;
        const { DB } = await import('https://deno.land/x/sqlite@v3.8/mod.ts' + '');
        const { DenoDir } = await import('https://esm.sh/jsr/@deno/cache-dir@0.11.1' + '');

        const root = DenoDir.tryResolveRootPath(undefined);
        if (root === undefined) throw new Error(`Unable to resolve deno cache dir`);
        const denoflareD1Dir = join(root, 'denoflare', 'd1');
        await Deno.mkdir(denoflareD1Dir, { recursive: true });
        const dbPath = join(denoflareD1Dir, `${d1DatabaseUuid}.db`);
        console.log(`SqliteD1Database: opening ${dbPath}`);
        const db = new DB(dbPath);
        this.db = db;
        this.dbPath = dbPath;
        return db;
    }

    private async getDBSizeInBytes(): Promise<number> {
        const { dbPath } = this;
        if (typeof dbPath !== 'string') throw new Error(`Cannot get size before db is opened`);
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

    private params?: unknown[];

    constructor({ query, dbProvider, sizeProvider }: { d1DatabaseUuid: string, query: string, dbProvider: () => Promise<DB>, sizeProvider: () => Promise<number> }) {
        this.query = query;
        this.dbProvider = dbProvider;
        this.sizeProvider = sizeProvider;
    }

    bind(...values: unknown[]): D1PreparedStatement {
        this.params = values.map(convertBindParamToQueryParameter)
        return this;
    }

    first<T = unknown>(column: string): Promise<T | null>;
    first<T = Record<string, unknown>>(): Promise<T | null>;
    async first<T>(column?: string): Promise<T | null> {
        const { dbProvider, query, params } = this;
        const db = await dbProvider();
        const pq = db.prepareQuery(query);
        try {
            const i = pq.columns().findIndex((v: { name: string }) => v.name === column);
            if (column && i < 0) throw new Error(`Unable to find column: ${column}`);
            for (const row of pq.iter(params)) {
                return (i < 0 ? row : row[i]) as T;
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
            for (const row of pq.iter(params)) {
                results.push(row as T);
            }
            const meta: D1QueryMetadata & Record<string, unknown> = {
                changed_db: db.changes > 0,
                changes: db.changes,
                duration: Date.now() - start,
                last_row_id: db.lastInsertRowId,
                rows_read: 0,
                rows_written: 0,
                size_after: await sizeProvider(),
                served_by: 'denoflare'
            }
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

}
