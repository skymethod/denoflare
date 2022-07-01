import { computeOauthObtainTokenRequest, computeOauthPkce, computeOauthRefreshTokenRequest, computeOauthUserAuthorizationUrl } from '../common/oauth.ts';
import { serve } from './deps.ts';
import { parseOptionalStringOption, parseRequiredStringOption } from '../cli/cli_common.ts';
import { CliCommand } from '../cli/cli_command.ts';

export const AUTH_COMMAND = CliCommand.of([ 'denoflaredev', 'auth' ]);

export async function auth(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    await AUTH_COMMAND.routeSubcommand(args, options, { tmp });
}

//

async function tmp(_args: (string | number)[], options: Record<string, unknown>) {
    const port = 8976;
    const authUrl = 'https://dash.cloudflare.com/oauth2/auth';
    const tokenUrl = 'https://dash.cloudflare.com/oauth2/token';
    const clientId = parseRequiredStringOption('client-id', options);
    const redirectUri = `http://localhost:${port}/oauth/callback`;
    const scopes = [ 'workers_scripts:write', 'zone:read', 'account:read', 'user:read', 'd1:write', 'offline_access' ];
    const oauthRequestId = { time: Date.now(), nonce: crypto.randomUUID().toLowerCase().split('-').pop()! };
    const state = [oauthRequestId.time, oauthRequestId.nonce].join(':');
    const { codeVerifier, codeChallenge, codeChallengeMethod } = await computeOauthPkce();

    const refreshToken = parseOptionalStringOption('refresh-token', options);
    if (refreshToken) {
        const req = computeOauthRefreshTokenRequest(tokenUrl, { grantType: 'refresh_token', clientId, refreshToken });
        const res = await fetch(req);
        console.log(`${res.status} ${res.url}`);
        console.log([...res.headers].map(v => v.join(': ')).join('\n'));
        console.log(await res.text());
        return;
    }
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

                // exchange auth code for token
                const req = computeOauthObtainTokenRequest(tokenUrl, { grantType: 'authorization_code', clientId, redirectUri, code, codeVerifier });
                const res = await fetch(req);
                console.log(`${res.status} ${res.url}`);
                console.log([...res.headers].map(v => v.join(': ')).join('\n'));
                console.log(await res.text());
            }
            return new Response('ok');
        }
        return new Response('not found', { status: 404 });
    };
    console.log(`Callback server: http://localhost:${port}`);
    await serve(handler, { port });
}
