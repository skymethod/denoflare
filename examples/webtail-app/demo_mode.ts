import { Tail, TailMessage } from './deps_app.ts';
import { TextItem } from './webtail_app_vm.ts';
import { packTailKey, TailControllerCallbacks, TailKey } from './tail_controller.ts';

export class DemoMode {

    static readonly profiles: TextItem[] = [
        { id: 'profile1', text: 'corp-profile' },
        { id: 'profile2', text: 'pers-profile' },
    ];

    static selectedProfileId: string | undefined = 'profile1'

    static setSelectedProfileId(_value: string | undefined) {
        
    }

    static readonly scripts: TextItem[] = [
        { id: 'script1', text: 'worker1-dev' },
        { id: 'script2', text: 'worker1-prod' },
        { id: 'script3', text: 'worker2-dev' },
        { id: 'script4', text: 'worker2-beta' },
        { id: 'script5', text: 'worker2-prod' },
        { id: 'script6', text: 'durable-object-demo' },
        { id: 'script7', text: 'secret-app' },
    ];

    static selectedScriptIds: ReadonlySet<string> = new Set([ 'script7', 'script4' ]);

    static setSelectedScriptIds(_scriptIds: ReadonlySet<string>) {
        
    }

    static tails: ReadonlySet<TailKey> = new Set();

    static logFakeOutput(callbacks: TailControllerCallbacks) {
        const accountId = '15a7fa3a37254fe4a7cadd1bb2762879';
        const scriptId = 'secret-app';
        callbacks.onTailCreating(accountId, scriptId);
        const tail: Tail = {
            id: 'db19eb8be9f4443aab91a9042c0d3517',
            url: 'wss://tail.developers.workers.dev/db19eb8be9f4443aab91a9042c0d3517',
            'expires_at': new Date().toISOString(),
        };
        callbacks.onTailCreated(accountId, scriptId, 155, tail);
        callbacks.onTailsChanged(new Set([ packTailKey(accountId, scriptId) ]));
        callbacks.onTailConnectionOpen(accountId, scriptId, Date.now(), 42);
        for (let i = 0; i < 2; i++) {
            callbacks.onTailConnectionMessage(accountId, scriptId, Date.now(), computeFakeRequest());
            callbacks.onTailConnectionMessage(accountId, scriptId, Date.now(), computeFakeDoRequest());
            callbacks.onTailConnectionMessage(accountId, scriptId, Date.now(), computeFakeRequestWithLogs());
            callbacks.onTailConnectionMessage(accountId, scriptId, Date.now(), computeFakeRequestExceedingTimeLimit());
        }
    }

}

//

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:91.0) Gecko/20100101 Firefox/91.0';

function computeFakeRequest(): TailMessage {
    const rt = {
        event: {
            request: {
                url: 'https://example.com/endpoint',
                method: 'GET',
                headers: {
                    'cf-connecting-ip': '203.0.113.12',
                    'user-agent': USER_AGENT,
                },
                cf: {
                    colo: 'DFW',
                }
            }
        },
        logs: [],
        exceptions: [],
        eventTimestamp: Date.now(),
        outcome: 'ok',
    };
    // deno-lint-ignore no-explicit-any
    return rt as any as TailMessage;
}

function computeFakeDoRequest(): TailMessage {
    const rt = {
        event: {
            request: {
                url: 'https://fake-host/put',
                method: 'PUT',
                headers: {
                },
            }
        },
        logs: [
            { level: 'log', timestamp: Date.now(), message: [ 'logprops:', { colo: 'EWR', durableObjectClass: 'LoggerDO', durableObjectId: '538fc7ce55b14e53b6b8552befeb9af4', durableObjectName: 'log1' }] },
        ],
        exceptions: [],
        eventTimestamp: Date.now(),
        outcome: 'ok',
    };
    // deno-lint-ignore no-explicit-any
    return rt as any as TailMessage;
}

function computeFakeRequestWithLogs(): TailMessage {
    const rt = {
        event: {
            request: {
                url: 'https://my-worker.subdomain.workers.dev/test?log=true',
                method: 'GET',
                headers: {
                    'cf-connecting-ip': '203.0.113.12',
                    'user-agent': USER_AGENT,
                },
                cf: {
                    colo: 'DFW',
                }
            }
        },
        logs: [
            { level: 'log', timestamp: Date.now(), message: [ 'Lorem ipsum dolor sit amet, consectetur adipiscing elit' ] },
            { level: 'error', timestamp: Date.now(), message: [ 'Lorem ipsum dolor sit amet, consectetur adipiscing elit' ] },
            { level: 'info', timestamp: Date.now(), message: [ 'Lorem ipsum dolor sit amet, consectetur adipiscing elit' ] },
            { level: 'warning', timestamp: Date.now(), message: [ 'Lorem ipsum dolor sit amet, consectetur adipiscing elit' ] },
            { level: 'debug', timestamp: Date.now(), message: [ 'Lorem ipsum dolor sit amet, consectetur adipiscing elit' ] },
        ],
        exceptions: [],
        eventTimestamp: Date.now(),
        outcome: 'ok',
    };
    // deno-lint-ignore no-explicit-any
    return rt as any as TailMessage;
}

function computeFakeRequestExceedingTimeLimit(): TailMessage {
    const rt = {
        event: {
            request: {
                url: 'https://my-worker.subdomain.workers.dev/compute-digits-of-pi',
                method: 'GET',
                headers: {
                    'cf-connecting-ip': '203.0.113.12',
                    'user-agent': USER_AGENT,
                },
                cf: {
                    colo: 'DFW',
                }
            }
        },
        logs: [
            { level: 'log', timestamp: Date.now(), message: [ 'burning cpu' ] },
        ],
        exceptions: [
            { name: 'Error', timestamp: Date.now(), message: 'Worker exceeded CPU time limit.' },
        ],
        eventTimestamp: Date.now(),
        outcome: 'exceededCpu',
    };
    // deno-lint-ignore no-explicit-any
    return rt as any as TailMessage;
}
