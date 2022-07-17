import { D1DatabaseProvider } from './cloudflare_workers_runtime.ts';
import { D1Database } from './cloudflare_workers_types.d.ts';

export class NoopD1Database implements D1Database {
    private readonly d1DatabaseUuid: string;
    
    private constructor(d1DatabaseUuid: string) {
        this.d1DatabaseUuid = d1DatabaseUuid;
    }

    fetch(_url: string | Request | URL, _init?: RequestInit): Promise<Response> {
        return Promise.resolve(new Response('not found', { status: 404 }));
    }

    static provider: D1DatabaseProvider = d1DatabaseUuid => new NoopD1Database(d1DatabaseUuid);
}
