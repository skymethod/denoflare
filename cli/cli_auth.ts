import { computeOauthPkce, computeOauthUserAuthorizationUrl } from '../common/oauth.ts';
import { CLI_VERSION } from './cli_version.ts';
import { serve } from './deps_cli.ts';
import { parseRequiredStringOption } from './cli_common.ts';

export async function auth(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    const subcommand = args[0];
    if (options.help && args.length === 0 || typeof subcommand !== 'string') {
        dumpHelp();
        return;
    }
    const fn = { 
        tmp,

     }[subcommand];
    if (fn) {
        await fn(args.slice(1), options);
    } else {
        dumpHelp();
    }
}

//

async function tmp(_args: (string | number)[], options: Record<string, unknown>) {
    const port = 8976;
    const authUrl = 'https://dash.cloudflare.com/oauth2/auth';
    const clientId = parseRequiredStringOption('client-id', options);
    const redirectUri = `http://localhost:${port}/oauth/callback`;
    const scopes = [ 'workers_scripts:write', 'zone:read', 'offline_access' ];
    const oauthRequestId = { time: Date.now(), nonce: crypto.randomUUID().toLowerCase().split('-').pop()! };
    const state = [oauthRequestId.time, oauthRequestId.nonce].join(':');
    const { codeVerifier, codeChallenge, codeChallengeMethod } = await computeOauthPkce();

    const url = computeOauthUserAuthorizationUrl(authUrl, { responseType: 'code', clientId, redirectUri, state, scopes, codeChallenge, codeChallengeMethod });
    console.log(url);
    const handler = async (request: Request): Promise<Response> => {
        console.log(`${request.method} ${request.url}}`);
        console.log([...request.headers].map(v => v.join(': ')).join('\n'));
        console.log(await request.text());

        const params = Object.fromEntries(new URL(request.url).searchParams.entries());
        if (params.state === state) {
            if ('error' in params) {
                console.log(`ERROR: ${JSON.stringify(params)}`);
            } else if ('code' in params && 'scope' in params) {
                const { code, scope } = params;
                console.log(`received code ${code} for scopes: ${scope.split(' ').join(', ')}`);
                console.log(`TODO exchange code for token, codeVerifier=${codeVerifier}`);
            }
            return new Response('ok');
        }
        return new Response('not found', { status: 404 });
    };
    console.log(`Callback server: http://localhost:${port}`);
    await serve(handler, { port });
}

function dumpHelp() {
    const lines = [
        `denoflare-auth ${CLI_VERSION}`,
        'Auth',
        '',
        'USAGE:',
        '    denoflare auth [subcommand] [FLAGS] [OPTIONS] [args]',
        '',
        'SUBCOMMANDS:',
        '',
        'For subcommand-specific help: denoflare auth [subcommand] --help',
    ];
    for (const line of lines) {
        console.log(line);
    }
}
