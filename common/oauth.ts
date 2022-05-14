import { Bytes } from './bytes.ts';

export async function computeOauthPkce(): Promise<{ codeVerifier: string, codeChallenge: string, codeChallengeMethod: 'S256' }> {
    const codeVerifier = computeOauthPkceCodeVerifier();
    const codeChallenge = encodeTrimmedUrlsafeBase64(await Bytes.ofUtf8(codeVerifier).sha256());
    return { codeVerifier, codeChallenge, codeChallengeMethod: 'S256' };
}

export interface OauthUserAuthorizationOpts {
    readonly responseType: string; // e.g. code

    readonly clientId: string;

    /** Set a URI to redirect the user to.
     * 
     * If this parameter is set to `urn:ietf:wg:oauth:2.0:oob` then the authorization code will be shown instead. */
    readonly redirectUri: string;

    /** requested oauth scopes */
    readonly scopes?: readonly string[];

    // standard oauth state
    readonly state?: string;

    // oauth PKCE: base64url(SHA256(code verifier))
    readonly codeChallenge?: string;

    // oauth PKCE: whether the challenge is the plain code verifier string or the SHA256 hash of the string.
    readonly codeChallengeMethod?: 'S256' | 'plain';
}

export function computeOauthUserAuthorizationUrl(authUrl: string, opts: OauthUserAuthorizationOpts): string {
    const { responseType, clientId, redirectUri, scopes, state, codeChallenge, codeChallengeMethod } = opts;
    const url = new URL(authUrl);
    url.searchParams.set('response_type', responseType);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    if (scopes && scopes.length > 0) url.searchParams.set('scope', scopes.join(' '));
    if (state) url.searchParams.set('state', state);
    if (codeChallenge) url.searchParams.set('code_challenge', codeChallenge);
    if (codeChallengeMethod) url.searchParams.set('code_challenge_method', codeChallengeMethod);
    return url.toString();
}

//

function encodeTrimmedUrlsafeBase64(bytes: Bytes) {
    return bytes.base64()
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function computeOauthPkceCodeVerifier() {
    // https://www.oauth.com/oauth2-servers/pkce/authorization-request/
    // Cryptographically random string using the characters A-Z, a-z, 0-9, and the punctuation characters -._~ (hyphen, period, underscore, and tilde), between 43 and 128 characters long.
    const bytes = new Bytes(crypto.getRandomValues(new Uint8Array(50)));
    return encodeTrimmedUrlsafeBase64(bytes);
}
