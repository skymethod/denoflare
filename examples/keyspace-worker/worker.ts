import { IncomingRequestCf, Kv, KvCommitError, KvCommitResult, KvKey, KvService, KvU64, makeRemoteService, Bytes } from './deps.ts';
import { Env } from './env.ts';
import { computeHtml } from './html.ts';

export default {

    async fetch(request: IncomingRequestCf, env: Env, { kvService }: Context): Promise<Response> {
        const { method, headers } = request;
        const { adminIp, remoteKvUrl, remoteKvAccessToken } = env;
        if (method !== 'GET') return new Response(`Method '${method}' not supported`, { status: 405 });
        const { pathname, searchParams} = new URL(request.url);
        const ip = headers.get('cf-connecting-ip') ?? '???';
        const admin = !!adminIp && adminIp === ip;

        if (pathname === '/') {
            const service = kvService ? 'deno' : 'cloudflare';
            const { colo } = request.cf;
            const { openKv } = kvService ?? makeRemoteService({ accessToken: remoteKvAccessToken!, debug: true });

            const times: Record<string, number> = {};
            const kv = await timed(times, 'openKv', () => openKv(kvService ? undefined : remoteKvUrl));
            try {
                if (admin && searchParams.has('clear')) await timed(times, 'adminClear', () => adminClear(kv));
                const visitorIp = admin && searchParams.has('ip') ? searchParams.get('ip')! : ip;
                const { attempts } = await timed(times, 'registerVisitor', () => registerVisitor(visitorIp, kv, service, colo));
                const coloCounts = await timed(times, 'gatherColoCounts', () => gatherColoCounts(kv));
                const html = computeHtml({ service, colo, coloCounts, attempts, times, env, admin, searchParams });
                return new Response(html, { headers: { 'content-Type': 'text/html; charset=utf-8' } });
            } finally {
                kv.close();
            }
        }

        return new Response('not found', { status: 404 });
    }

};

//

type Context = { kvService?: KvService };
type VisitorInfo = { service: string, colo: string, updated: string };

const MINUS_ONE = (1n << 64n) - 1n;

function packVisitorInfo(info: VisitorInfo): string {
    return JSON.stringify(info);
}

function tryUnpackVisitorInfo(value: unknown): VisitorInfo | undefined {
    if (typeof value !== 'string') return undefined;
    try {
        const { service, colo, updated } = JSON.parse(value);
        return typeof service === 'string' && typeof colo === 'string' && typeof updated === 'string' ? { service, colo, updated } : undefined;
    } catch {
        return undefined;
    }
}

async function adminClear(kv: Kv) {
    const keys: KvKey[] = [];
    for await (const { key } of kv.list({ prefix: [] })) {
        keys.push(key);
    }
    const op = kv.atomic();
    for (const key of keys) {
        op.delete(key);
    }
    await op.commit();
    console.log(`Deleted ${keys.length} records`);
}

async function registerVisitor(ip: string, kv: Kv, service: string, colo: string) {
    const visitor = (await Bytes.ofUtf8(ip).sha1()).hex();

    const visitorKey = [ 'visitors', visitor ];
   
    const makeServiceCountKey = (service: string) => [ 'counts', 'service', service ];
    const makeColoCountKey = (service: string, colo: string) => [ 'counts', 'service-colo', service, colo ];
    const makeUpdatedKey = (updated: string, visitor: string ) => [ 'updated', `${updated}|${visitor}` ];

    const newOperation = (existingVisitorVersionstamp: string | null, existingVisitor: VisitorInfo | undefined) => {
        const updated = new Date().toISOString();
        const { service: oldService, colo: oldColo, updated: oldUpdated } = existingVisitor ?? {};
        const op = kv.atomic()
            .set(visitorKey, packVisitorInfo({ service, colo, updated }))
            .set(makeUpdatedKey(updated, visitor), null)
            .check({ key: visitorKey, versionstamp: existingVisitorVersionstamp })
            ;
        if (oldService !== service) op.sum(makeServiceCountKey(service), 1n);
        if (oldService !== service && oldService) op.sum(makeServiceCountKey(oldService), MINUS_ONE);
        if (oldColo !== colo) op.sum(makeColoCountKey(service, colo), 1n);
        if (oldColo !== colo && oldService && oldColo) op.sum(makeColoCountKey(oldService, oldColo), MINUS_ONE);
        if (oldUpdated) op.delete(makeUpdatedKey(oldUpdated, visitor));
            
        return op;
    }

    let commitResult: KvCommitError | KvCommitResult = { ok: false };
    let attempts = 0;
    while (!commitResult.ok) {
        const existingVisitorEntry = await kv.get(visitorKey);
        const existingVisitor = tryUnpackVisitorInfo(existingVisitorEntry.value);

        attempts++;
        commitResult = await newOperation(existingVisitorEntry.versionstamp, existingVisitor).commit();
    }

    return { visitor, commitResult, attempts };
}

async function gatherColoCounts(kv: Kv): Promise<Record<string,Record<string,number>>> {
    const rt: Record<string, Record<string,number>> = {};
    for await (const { key, value } of  kv.list({ prefix: [ 'counts', 'service-colo' ] })) {
        const service = key.at(-2)! as string;
        const colo = key.at(-1)! as string;
        const record = rt[service] ?? {};
        rt[service] = record;
        const count = Number((value as KvU64).value);
        rt[service][colo] = count;
    }
    return rt;
}

async function timed<T>(times: Record<string, number>, key: string, work: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const result = await work();
    increment(times, key, Date.now() - start);
    return result;
}

function increment(summary: Record<string, number>, key: string, delta = 1) {
    const existing = summary[key];
    summary[key] = (typeof existing === 'number' ? existing : 0) + delta;
}
