import { deploy, DeployRequest, negotiateAssets } from './deno_deploy_api.ts';
import { Bytes } from '../common/bytes.ts';

//

if (import.meta.main) {
    const [ apiToken, projectId ] = Deno.args;
    
    const script = `
    import { serve } from 'https://deno.land/std@0.145.0/http/server.ts';
    
    serve((req, init) => {
        return new Response('hello!');
    });    
    
`;

    const bytes = Bytes.ofUtf8(script);

    const request: DeployRequest = {
        url: 'file:///src/hello.ts',
        importMapUrl: null,
        production: true,
        manifest: { entries: {
            'hello.ts': {
                kind: 'file',
                size: bytes.length,
                gitSha1: await bytes.gitSha1Hex(),
            }
        }},
    };

    console.log(JSON.stringify(await negotiateAssets({ projectId, apiToken, manifest: request.manifest! }), undefined, 2));

    const files: Uint8Array[] = [];
    files.push(bytes.array());

    for await (const message of deploy({ projectId, apiToken, request, files })) {
        console.log(JSON.stringify(message));
    }
}
