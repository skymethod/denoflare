import { DurableObjectNamespace, DurableObjectId, DurableObjectStub } from 'https://github.com/skymethod/cloudflare-workers-types/raw/ab2ff7fd2ce19f35efdf0ab0fdcf857404ab0c17/cloudflare_workers_types.d.ts';
import { ApiKVNamespace } from './api_kv_namespace.ts';
import { defineGlobals, dispatchFetchEvent } from './cloudflare_workers_runtime.ts';
import { Binding, Credential } from './config.ts';
import { consoleLog } from './console.ts';
import { SubtleCryptoPolyfill } from './subtle_crypto_polyfill.ts';

export class InProcessScriptServer {

    private readonly fetchListener: EventListener;

    private constructor(fetchListener: EventListener) {
        this.fetchListener = fetchListener;
    }

    static async start(scriptPath: string, bindings: Record<string, Binding>, credential: Credential): Promise<InProcessScriptServer> {
        const { accountId, apiToken } = credential;

        SubtleCryptoPolyfill.applyIfNecessary();

        defineGlobals(bindings, kvNamespace => new ApiKVNamespace(accountId, apiToken, kvNamespace), doNamespace => new UnimplementedDurableObjectNamespace(doNamespace));

        let fetchListener: EventListener | undefined;
    
        const addEventListener = (type: string, listener: EventListener) => {
            consoleLog(`worker: addEventListener type=${type}`);
            if (type === 'fetch') {
                fetchListener = listener;
            }
        };
        // deno-lint-ignore no-explicit-any
        (self as any).addEventListener = addEventListener;

        await import(scriptPath);

        if (fetchListener === undefined) throw new Error(`Script did not add a fetch listener`);

        return new InProcessScriptServer(fetchListener);
    }

    async fetch(request: Request, cfConnectingIp: string): Promise<Response> {
        consoleLog(`${request.method} ${request.url}`);
        const req = new Request(request, { headers: [ ...request.headers, ['cf-connecting-ip', cfConnectingIp] ] });
        const response = await dispatchFetchEvent(req, { colo: 'DNO' }, this.fetchListener);
        return response;
    }
}

//

class UnimplementedDurableObjectNamespace implements DurableObjectNamespace {
    readonly doNamespace: string;

    constructor(doNamespace: string) {
        this.doNamespace = doNamespace;
    }

    newUniqueId(_opts?: { jurisdiction: 'eu' }): DurableObjectId {
        throw new Error(`UnimplementedDurableObjectNamespace.newUniqueId not implemented.`);
    }

    idFromName(_name: string): DurableObjectId {
        throw new Error(`UnimplementedDurableObjectNamespace.idFromName not implemented.`);
    }

    idFromString(_hexStr: string): DurableObjectId {
        throw new Error(`UnimplementedDurableObjectNamespace.idFromString not implemented.`);
    }

    get(_id: DurableObjectId): DurableObjectStub {
        throw new Error(`UnimplementedDurableObjectNamespace.get not implemented.`);
    }

}
