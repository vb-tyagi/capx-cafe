// Real X API v2 implementations for the injected seams (token exchange, refresh, identity). Each is a
// factory over an injected FetchLike, so they're unit-tested with a mock fetch and only touch the
// network when serve.ts wires real fetch. Public clients (BYO) send client_id in the body; confidential
// clients (capx-app lane) add HTTP Basic auth with the client secret. See §3/§5.7.
import type { FetchLike } from './index.ts';
import type { TokenExchange, IdentityFetch } from '../oauth/index.ts';
import type { RefreshExchange } from '../oauth/refresh.ts';

const TOKEN_ENDPOINT = 'https://api.twitter.com/2/oauth2/token';
// user.fields is REQUIRED to get verified + created_at; without it X returns only id/name/username.
// Loops need both: casserole L1 gates scheduled posting on blue-tick + account age (>=30d).
const IDENTITY_ENDPOINT = 'https://api.twitter.com/2/users/me?user.fields=verified,created_at';
const FORM = 'application/x-www-form-urlencoded';

function basicAuth(clientId: string, clientSecret?: string): Record<string, string> {
  if (!clientSecret) return {};
  return { authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}` };
}

async function readJson<T>(res: { ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }, what: string): Promise<T> {
  if (!res.ok) throw new Error(`${what} ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/** Exchange an authorization code (+ PKCE verifier) for tokens. redirect_uri must match the consent URL. */
export function httpTokenExchange(fetchImpl: FetchLike, cfg: { redirectUri: string; endpoint?: string }): TokenExchange {
  return async ({ code, verifier, clientId, clientSecret }) => {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: cfg.redirectUri,
      code_verifier: verifier,
    });
    const res = await fetchImpl(cfg.endpoint ?? TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': FORM, ...basicAuth(clientId, clientSecret) },
      body: body.toString(),
    });
    const data = await readJson<{ access_token?: string; refresh_token?: string }>(res, 'X token exchange');
    if (!data.access_token || !data.refresh_token) throw new Error('X token exchange: missing access/refresh token');
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  };
}

/** Refresh grant — X rotates the refresh token, so persist the new one (the Refresher does, atomically). */
export function httpRefreshExchange(fetchImpl: FetchLike, cfg?: { endpoint?: string }): RefreshExchange {
  return async ({ refreshToken, clientId, clientSecret }) => {
    const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId });
    const res = await fetchImpl(cfg?.endpoint ?? TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': FORM, ...basicAuth(clientId, clientSecret) },
      body: body.toString(),
    });
    const data = await readJson<{ access_token?: string; refresh_token?: string }>(res, 'X token refresh');
    if (!data.access_token || !data.refresh_token) throw new Error('X token refresh: missing access/refresh token');
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  };
}

/**
 * Resolve the connected account (GET /2/users/me) with the freshly-minted access token.
 * Also captures verified + created_at, which casserole L1 needs to gate Loops. If X omits created_at
 * (field not granted on the app's access tier), createdAtMs is 0 — which reads as a 0-day-old account
 * and FAILS the loop age gate. That is deliberate: fail closed rather than let an unknown-age account
 * schedule autonomous posts. Manual post_now is unaffected (L1 only gates when ctx.loop is set).
 */
export function httpIdentity(fetchImpl: FetchLike, cfg?: { endpoint?: string }): IdentityFetch {
  return async (accessToken) => {
    const res = await fetchImpl(cfg?.endpoint ?? IDENTITY_ENDPOINT, {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const data = await readJson<{ data?: { id?: string; username?: string; verified?: boolean; created_at?: string } }>(
      res,
      'X users/me',
    );
    if (!data.data?.id || !data.data?.username) throw new Error('X users/me: missing id/username');
    const createdAtMs = data.data.created_at ? Date.parse(data.data.created_at) : 0;
    return {
      xUserId: data.data.id,
      username: data.data.username,
      verified: Boolean(data.data.verified),
      createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : 0,
    };
  };
}
