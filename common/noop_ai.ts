import { AIProvider } from './cloudflare_workers_runtime.ts';
import { AI } from './cloudflare_workers_types.d.ts';

export class NoopAI implements AI {
    private readonly ai: string;

    constructor(ai: string) {
        this.ai = ai;
    }

    // deno-lint-ignore no-explicit-any
    run(_model: string, _options: unknown): Promise<any> {
        return Promise.resolve({});
    }

    static provider: AIProvider = ai => new NoopAI(ai);
}
