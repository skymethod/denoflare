import { Bytes } from './bytes.ts';

// auth url -> user grant -> auth code

export async function computeOauthPkce(): Promise<{ codeVerifier: string, codeChallenge: string, codeChallengeMethod: 'S256' }> {
    const codeVerifier = computeOauthPkceCodeVerifier();
    const codeChallenge = encodeTrimmedUrlsafeBase64(await Bytes.ofUtf8(codeVerifier).sha256());
    return { codeVerifier, codeChallenge, codeChallengeMethod: 'S256' };
}

export interface OauthUserAuthorizationOpts {
    readonly responseType: string; // e.g. code
    readonly clientId: string;
    readonly redirectUri: string;
    readonly scopes?: readonly string[];
    readonly state?: string;
    // pkce: base64url(SHA256(code verifier))
    readonly codeChallenge?: string;
    // pkce: whether the challenge is the plain code verifier string or the SHA256 hash of the string
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

// auth code -> obtain token

export interface OauthObtainTokenOpts {
    readonly grantType: 'authorization_code' | 'client_credentials';
    readonly clientId: string;
    readonly redirectUri: string;
    readonly code?: string;
    readonly codeVerifier?: string; // pkce
}

export function computeOauthObtainTokenRequest(tokenUrl: string, opts: OauthObtainTokenOpts): Request {
    const { grantType, clientId, redirectUri, code, codeVerifier } = opts;
    const data = new FormData();
    data.set('grant_type', grantType);
    data.set('client_id', clientId);
    data.set('redirect_uri', redirectUri);
    if (code) data.set('code', code);
    if (codeVerifier) data.set('code_verifier', codeVerifier);
    return new Request(tokenUrl, { method: 'POST', body: data });
}

// https://datatracker.ietf.org/doc/html/rfc6749#section-4.2.2
export interface OauthTokenResponse {

    /** REQUIRED.  The access token issued by the authorization server. */
    readonly access_token: string;

    /** REQUIRED.  The type of the token issued as described in Section 7.1.  
     * 
     * Value is case insensitive. */
    readonly token_type: string; // e.g. Bearer

    /** OPTIONAL, if identical to the scope requested by the client; otherwise, REQUIRED.  
     * The scope of the access token as described by Section 3.3. */
    readonly scope: string; // e.g. write:statuses read:accounts

    // additional fields found only in Pleroma:

    /** RECOMMENDED.  The lifetime in seconds of the access token.
     * 
     * For example, the value "3600" denotes that the access token will 
     * expire in one hour from the time the response was generated. 
     * 
     * If omitted, the authorization server SHOULD provide the 
     * expiration time via other means or document the default value. */
    readonly expires_in?: number; 

    /** OPTIONAL.  The refresh token, which can be used to obtain new access tokens using the same authorization grant as described in Section 6. */
    readonly refresh_token?: string;
}

// refresh token -> new token

export interface OauthRefreshTokenOpts {
    readonly grantType: 'refresh_token';
    readonly refreshToken: string;
    readonly clientId: string;
}

export function computeOauthRefreshTokenRequest(tokenUrl: string, opts: OauthRefreshTokenOpts): Request {
    const { grantType, clientId, refreshToken } = opts;
    const data = new FormData();
    data.set('grant_type', grantType);
    data.set('client_id', clientId);
    data.set('refresh_token', refreshToken);
    return new Request(tokenUrl, { method: 'POST', body: data });
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
