import type { PipelineTransform } from './cloudflare_workers_types.d.ts';

export function cloudflarePipelineTransform() {
   return { PipelineTransform: StubPipelineTransform }
}

class StubPipelineTransform implements PipelineTransform {
    constructor(ctx: unknown, env: unknown) {
    }

    transformJson(_data: object[]): Promise<object[]> {
        throw new Error('Method not implemented.');
    }
}
