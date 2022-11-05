import { D1DatabaseProvider } from './cloudflare_workers_runtime.ts';
import { D1Database, D1PreparedStatement, D1Result } from './cloudflare_workers_types.d.ts';

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

    exec<T = unknown>(_query: string): Promise<D1Result<T>> {
        return Promise.resolve(computeNoopD1Result<T>());
    }

    static provider: D1DatabaseProvider = d1DatabaseUuid => new NoopD1Database(d1DatabaseUuid);
}

//

function computeNoopD1Result<T>(): D1Result<T> {
    return {
        lastRowId: null,
        changes: 0,
        duration: 0,
    };
}

//

class NoopD1PreparedStatement implements D1PreparedStatement {

    bind(..._values: unknown[]): D1PreparedStatement {
        return this;
    }

    first<T = unknown>(_column?: string): Promise<T> {
        throw new Error(`No columns`);
    }

    all<T = unknown>(): Promise<D1Result<T>> {
        return Promise.resolve(computeNoopD1Result<T>());
    }

    raw<T = unknown>(): Promise<T[]> {
        return Promise.resolve([]);
    }

    run<T = unknown>(): Promise<D1Result<T>> {
        return Promise.resolve(computeNoopD1Result<T>());
    }

}
