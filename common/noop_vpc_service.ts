import { VpcServiceProvider } from './cloudflare_workers_runtime.ts';
import { VpcService } from './cloudflare_workers_types.d.ts';

export class NoopVpcService implements VpcService {
    private readonly vpcService: string;

    constructor(vpcService: string) {
        this.vpcService = vpcService;
    }

    fetch(input: URL | Request | string, init?: RequestInit): Promise<Response> {
        console.log(`NoopVpcService.fetch(${JSON.stringify({ input, init })})`);
        return Promise.resolve(new Response());
    }

    static provider: VpcServiceProvider = vpcService => new NoopVpcService(vpcService);
}
