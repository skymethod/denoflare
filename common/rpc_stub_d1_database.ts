import { D1Database, D1ExecResult, D1PreparedStatement, D1Result } from './cloudflare_workers_types.d.ts';
import { RpcChannel } from './rpc_channel.ts';

export function makeRpcStubD1DatabaseProvider(channel: RpcChannel): (d1DatabaseUuid: string) => D1Database {
    return d1DatabaseUuid => {
        return new RpcD1Database(channel, { d1DatabaseUuid });
    }
}
export type ErrorResponse = { error: string };

export type ExecRequest = { method: 'exec', d1DatabaseUuid: string, query: string };
export type ExecResponse = { result: D1ExecResult };

export type PackedParamValue = null | number | string | boolean | ArrayBuffer | Uint8Array;
export type PackedPreparedStatement = { query: string, params: PackedParamValue[] };

export type BatchRequest = { method: 'batch', d1DatabaseUuid: string, statements: PackedPreparedStatement[] };
export type BatchResponse = { result: D1Result[] };

export type FirstRequest = { method: 'first', d1DatabaseUuid: string, column: string | undefined, query: string, params: PackedParamValue[] };
export type FirstResponse = { result: unknown };

export type AllRequest = { method: 'all', d1DatabaseUuid: string, query: string, params: PackedParamValue[] };
export type AllResponse = { result: D1Result };

export type RawRequest = { method: 'raw', d1DatabaseUuid: string, query: string, params: PackedParamValue[], columnNames: boolean | undefined };
export type RawResponse = { result: unknown[] };

//

class RpcD1Database implements D1Database {
    private readonly channel: RpcChannel;
    private readonly d1DatabaseUuid: string;

    constructor(channel: RpcChannel, { d1DatabaseUuid }: { d1DatabaseUuid: string }) {
        this.channel = channel;
        this.d1DatabaseUuid = d1DatabaseUuid;
    }

    prepare(query: string): D1PreparedStatement {
        const { channel, d1DatabaseUuid } = this;
        return new RpcD1PreparedStatement(channel, { d1DatabaseUuid, query });
    }

    dump(): Promise<ArrayBuffer> {
        throw new Error(`dump() not implemented`);
    }

    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
        const { d1DatabaseUuid } = this;
        const request: BatchRequest = { method: 'batch', d1DatabaseUuid, statements: statements.map(RpcD1PreparedStatement.toPacked) };
        return await this.channel.sendRequest('d1', request, (data: BatchResponse | ErrorResponse) => {
            if ('error' in data) throw new Error(data.error);
            return data.result as D1Result<T>[];
        });
    }

    async exec(query: string): Promise<D1ExecResult> {
        const { d1DatabaseUuid } = this;
        const request: ExecRequest = { method: 'exec', d1DatabaseUuid, query };
        return await this.channel.sendRequest('d1', request, (data: ExecResponse | ErrorResponse) => {
            if ('error' in data) throw new Error(data.error);
            return data.result;
        });
    }

}


function checkParamValue(value: unknown, index: number): PackedParamValue {
    if (value === null || typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' || value instanceof ArrayBuffer || value instanceof Uint8Array) return value;
    throw new Error(`Unsupported d1 param value at index ${index}: ${value}`);
}

class RpcD1PreparedStatement implements D1PreparedStatement {
    private readonly channel: RpcChannel;

    readonly d1DatabaseUuid: string;
    readonly query: string;
    params: PackedParamValue[] = [];

    constructor(channel: RpcChannel, { query, d1DatabaseUuid }: { query: string, d1DatabaseUuid: string }) {
        this.channel = channel;
        this.d1DatabaseUuid = d1DatabaseUuid;
        this.query = query;
    }

    bind(...values: unknown[]): D1PreparedStatement {
        this.params = values.map(checkParamValue);
        return this;
    }

    first<T = unknown>(column: string): Promise<T | null>;
    first<T = Record<string, unknown>>(): Promise<T | null>;
    async first<T>(column?: string): Promise<T | null> {
        const { d1DatabaseUuid, query, params } = this;
        const request: FirstRequest = { method: 'first', d1DatabaseUuid, column, query, params };
        return await this.channel.sendRequest('d1', request, (data: FirstResponse | ErrorResponse) => {
            if ('error' in data) throw new Error(data.error);
            return data.result as T;
        });
    }

    async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        const { d1DatabaseUuid, query, params } = this;
        const request: AllRequest = { method: 'all', d1DatabaseUuid, query, params };
        return await this.channel.sendRequest('d1', request, (data: AllResponse | ErrorResponse) => {
            if ('error' in data) throw new Error(data.error);
            return data.result as D1Result<T>;
        });
    }

    async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
        return await this.all<T>();
    }

    raw<T = unknown[]>(options: { columnNames: true }): Promise<[ string[], ...T[] ]>;
    raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
    async raw<T = unknown[]>({ columnNames = false }: { columnNames?: boolean } = {}): Promise<T[] | [ string[], ...T[] ]> {
        const { d1DatabaseUuid, query, params } = this;
        const request: RawRequest = { method: 'raw', d1DatabaseUuid, query, params, columnNames };
        return await this.channel.sendRequest('d1', request, (data: RawResponse | ErrorResponse) => {
            if ('error' in data) throw new Error(data.error);
            return data.result as T[] | [ string[], ...T[] ];
        });
    }

    static toPacked(statement: D1PreparedStatement): PackedPreparedStatement {
        const { query, params } = statement as RpcD1PreparedStatement;
        return { query, params };
    }

}
