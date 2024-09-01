import { D1DatabaseProvider } from './cloudflare_workers_runtime.ts';
import { D1Database, D1ExecResult, D1PreparedStatement, D1Result } from './cloudflare_workers_types.d.ts';

export class NoopD1Database implements D1Database {
    private readonly d1DatabaseUuid: string;
    
    private constructor(d1DatabaseUuid: string) {
        this.d1DatabaseUuid = d1DatabaseUuid;
    }

    prepare(_query: string): D1PreparedStatement {
        return new NoopD1PreparedStatement();
    }

    dump(): Promise<ArrayBuffer> {
        return Promise.resolve(new ArrayBuffer(0));
    }

    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
        return Promise.resolve(statements.map(() => computeNoopD1Result<T>()));
    }

    exec(_query: string): Promise<D1ExecResult> {
        return Promise.resolve({ count: 0, duration: 0 });
    }

    static provider: D1DatabaseProvider = d1DatabaseUuid => new NoopD1Database(d1DatabaseUuid);
}

//

function computeNoopD1Result<T>(): D1Result<T> {
    return {
        success: true,
        results: [],
        meta: {
            changed_db: false,
            changes: 0,
            duration: 0,
            last_row_id: 0,
            rows_read: 0,
            rows_written: 0,
            size_after: 0
        }
    };
}

//

class NoopD1PreparedStatement implements D1PreparedStatement {

    bind(..._values: unknown[]): D1PreparedStatement {
        return this;
    }

    first<T = unknown>(column: string): Promise<T | null>;
    first<T = Record<string, unknown>>(): Promise<T | null>;
    first<T>(_column?: string): Promise<T | null> {
        return Promise.resolve(null);
    }

    all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        return Promise.resolve(computeNoopD1Result());
    }

    raw<T = unknown[]>(options: { columnNames: true }): Promise<[ string[], ...T[] ]>;
    raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
    raw<T = unknown[]>({ columnNames }: { columnNames?: boolean } = {}): Promise<[ string[], ...T[] ] | T[]> {
        if (columnNames) {
            return Promise.resolve([ [] ] as [ string[], ...T[] ]);
        } else {
            return Promise.resolve([] as T[]);
        }
    }

    run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        return Promise.resolve(computeNoopD1Result());
    }

}
