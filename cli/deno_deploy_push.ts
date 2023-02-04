import { deploy, DeployRequest, negotiateAssets, setEnvironmentVariables } from './deno_deploy_api.ts';
import { Bytes } from '../common/bytes.ts';

//

async function _testDeploy(opts: { projectId: string, apiToken: string }) {
    const { projectId, apiToken } = opts;

    const script = `
    import { serve } from 'https://deno.land/std@0.176.0/http/server.ts';
    
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

if (import.meta.main) {
    const [ apiToken, projectId ] = Deno.args;

    // await testDeploy({ apiToken, projectId });
    const result = await setEnvironmentVariables({ apiToken, projectId, variables: { foo: null } });
    console.log({ result });
}
