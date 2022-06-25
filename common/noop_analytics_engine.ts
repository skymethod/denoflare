import { AnalyticsEngineProvider } from './cloudflare_workers_runtime.ts';
import { AnalyticsEngine, AnalyticsEngineEvent } from './cloudflare_workers_types.d.ts';

export class NoopAnalyticsEngine implements AnalyticsEngine {
    private readonly dataset: string;

    constructor(dataset: string) {
        this.dataset = dataset;
    }

    writeDataPoint(event: AnalyticsEngineEvent): void {
        console.log(`${this.dataset}.writeDataPoint (no-op)`, event);
    }

    static provider: AnalyticsEngineProvider = dataset => new NoopAnalyticsEngine(dataset);
}
