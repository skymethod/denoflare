import { D1Database, D1PreparedStatement } from '../common/cloudflare_workers_types.d.ts';
import { RpcChannel } from '../common/rpc_channel.ts';
import { AllRequest, AllResponse, BatchRequest, BatchResponse, ErrorResponse, ExecRequest, ExecResponse, FirstRequest, FirstResponse, PackedPreparedStatement, RawRequest, RawResponse } from '../common/rpc_stub_d1_database.ts';
import { SqliteD1Database } from './sqlite_d1_database.ts';

export function makeRpcHostD1Database(channel: RpcChannel) {
    const cache = new Map<string, D1Database>();
    channel.addRequestHandler('d1', async data => {
        if (typeof data === 'object') {
            if (typeof data.method === 'string') {
                const { method } = data;
                if (method === 'exec') {
                    const { d1DatabaseUuid, query } = data as ExecRequest;
                    try {
                        const db = locateDatabase(d1DatabaseUuid, cache);
                        const result = await db.exec(query);
                        return { result } as ExecResponse;
                    } catch (e) {
                        return { error: `${e}`} as ErrorResponse;
                    }
                } else if (method === 'batch') {
                    const { d1DatabaseUuid, statements } = data as BatchRequest;
                    try {
                        const db = locateDatabase(d1DatabaseUuid, cache);
                        const result = await db.batch(statements.map(v => unpackStatement(v, db)));
                        return { result } as BatchResponse;
                    } catch (e) {
                        return { error: `${e}`} as ErrorResponse;
                    }
                } else if (method === 'first') {
                    const { d1DatabaseUuid, column, query, params } = data as FirstRequest;
                    try {
                        const db = locateDatabase(d1DatabaseUuid, cache);
                        const pq = unpackStatement({ query, params }, db);
                        const result = column ? await pq.first(column) : await pq.first();
                        return { result } as FirstResponse;
                    } catch (e) {
                        return { error: `${e}`} as ErrorResponse;
                    }
                } else if (method === 'all') {
                    const { d1DatabaseUuid, query, params } = data as AllRequest;
                    try {
                        const db = locateDatabase(d1DatabaseUuid, cache);
                        const result = await unpackStatement({ query, params }, db).all();
                        return { result } as AllResponse;
                    } catch (e) {
                        return { error: `${e}`} as ErrorResponse;
                    }
                } else if (method === 'raw') {
                    const { d1DatabaseUuid, query, params } = data as RawRequest;
                    try {
                        const db = locateDatabase(d1DatabaseUuid, cache);
                        const result = await unpackStatement({ query, params }, db).raw();
                        return { result } as RawResponse;
                    } catch (e) {
                        return { error: `${e}`} as ErrorResponse;
                    }
                } else {
                    throw new Error(`RpcHostD1Database: unsupported method: ${method}`);
                }
            }
        }
    });
}

//

function locateDatabase(d1DatabaseUuid: string, cache: Map<string, D1Database>): D1Database {
    let db = cache.get(d1DatabaseUuid);
    if (!db) {
        db = SqliteD1Database.provider(d1DatabaseUuid);
        console.log(`RpcHostD1Database: created: ${d1DatabaseUuid} -> ${db}`);
        cache.set(d1DatabaseUuid, db);
    }
    return db;
}

function unpackStatement({ params, query }: PackedPreparedStatement, db: D1Database): D1PreparedStatement {
    return db.prepare(query).bind(...params);
}
