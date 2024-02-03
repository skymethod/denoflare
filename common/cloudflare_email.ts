import { EmailMessageConstructable, EmailMessage } from './cloudflare_workers_types.d.ts';

export function cloudflareEmail(): CloudflareEmail {
    // deno-lint-ignore no-explicit-any
    const provider = (globalThis as any).__cloudflareEmailProvider;
    if (typeof provider === 'function') return provider();
    return { EmailMessage: StubEmailMessage };
}

export interface CloudflareEmail {
    EmailMessage: EmailMessageConstructable, 
}

class StubEmailMessage implements EmailMessage {
    readonly from: string;
    readonly to: string;
    get headers(): Headers { throw new Error(); }
    get raw(): ReadableStream { throw new Error(); }
    get rawSize(): number { throw new Error(); }

    constructor(from: string, to: string, _raw: ReadableStream | string) {
        this.from = from;
        this.to = to;
    }

    setReject(reason: string): void {
        throw new Error(`setReject(${JSON.stringify({ reason })})`);
    }

    forward(rcptTo: string, headers?: Headers | undefined): Promise<void> {
        throw new Error(`forward(${JSON.stringify({ rcptTo, headers })})`);
    }

    reply(message: EmailMessage): Promise<void> {
        throw new Error(`forward(${JSON.stringify({ message })})`);
    }

}
