import { EmailSenderProvider } from './cloudflare_workers_runtime.ts';
import { EmailMessage, EmailSender } from './cloudflare_workers_types.d.ts';

export class NoopEmailSender implements EmailSender {
    private readonly destinationAddresses: string;

    constructor(destinationAddresses: string) {
        this.destinationAddresses = destinationAddresses;
    }

    send(message: EmailMessage): Promise<void> {
        console.log(`NoopEmailSender.send: ${JSON.stringify(message)}`);
        return Promise.resolve();
    }

    static provider: EmailSenderProvider = destinationAddresses => new NoopEmailSender(destinationAddresses);
}
