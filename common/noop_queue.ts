import { QueueProvider } from './cloudflare_workers_runtime.ts';
import { Queue, QueuesContentType } from './cloudflare_workers_types.d.ts';

export class NoopQueue implements Queue {
    private readonly queueName: string;

    constructor(queueName: string) {
        this.queueName = queueName;
    }

    send(message: unknown, opts?: { contentType?: QueuesContentType }): Promise<void> {
        console.log(`NoopQueue.send(${JSON.stringify(message)}, ${JSON.stringify(opts)})`);
        return Promise.resolve();
    }

    sendBatch(messages: Iterable<{ body: unknown, contentType?: QueuesContentType }>): Promise<void> {
        console.log(`NoopQueue.sendBatch(${JSON.stringify(messages)})`);
        return Promise.resolve();
    }

    static provider: QueueProvider = queueName => new NoopQueue(queueName);
}
