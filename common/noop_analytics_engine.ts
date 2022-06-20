import { AnalyticsEngineProvider } from './cloudflare_workers_runtime.ts';
import { AnalyticsEngine, AnalyticsEngineEvent } from './cloudflare_workers_types.d.ts';

export class NoopAnalyticsEngine implements AnalyticsEngine {
    private readonly dataset: string;

    constructor(dataset: string) {
        this.dataset = dataset;
    }

    writeEvent(event?: AnalyticsEngineEvent): void {
        console.log(`${this.dataset}.writeEvent (no-op)`, event);
    }

    logEvent(event?: AnalyticsEngineEvent): void {
        console.log(`${this.dataset}.logEvent (no-op)`, event);
    }

    static provider: AnalyticsEngineProvider = dataset => new NoopAnalyticsEngine(dataset);
}
