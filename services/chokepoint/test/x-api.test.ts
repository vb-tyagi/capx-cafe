import { test } from 'node:test';
import assert from 'node:assert/strict';
import { httpTokenExchange, httpRefreshExchange, httpIdentity } from '../src/xclient/x-api.ts';
import type { FetchLike, MinimalResponse } from '../src/xclient/index.ts';

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };

function mockFetch(body: unknown, ok = true, status = 200): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body });
    const res: MinimalResponse = { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
    return res;
  };
  return { fetch, calls };
}

test('httpTokenExchange: authorization_code grant with PKCE verifier + redirect_uri', async () => {
  const m = mockFetch({ access_token: 'AT', refresh_token: 'RT' });
  const exchange = httpTokenExchange(m.fetch, { redirectUri: 'https://cp.example/oauth/callback' });
  const out = await exchange({ code: 'the-code', verifier: 'the-verifier', clientId: 'byo-client' });
  assert.deepEqual(out, { accessToken: 'AT', refreshToken: 'RT' });
  const body = m.calls[0]?.body ?? '';
  assert.match(body, /grant_type=authorization_code/);
  assert.match(body, /code=the-code/);
  assert.match(body, /code_verifier=the-verifier/);
  assert.match(body, /redirect_uri=https%3A%2F%2Fcp.example%2Foauth%2Fcallback/);
  assert.equal(m.calls[0]?.headers.authorization, undefined, 'public client sends no Basic auth');
});

test('httpTokenExchange: confidential client adds HTTP Basic auth', async () => {
  const m = mockFetch({ access_token: 'AT', refresh_token: 'RT' });
  const exchange = httpTokenExchange(m.fetch, { redirectUri: 'https://cp.example/cb' });
  await exchange({ code: 'c', verifier: 'v', clientId: 'capx-app', clientSecret: 's3cret' });
  assert.equal(m.calls[0]?.headers.authorization, `Basic ${Buffer.from('capx-app:s3cret').toString('base64')}`);
});

test('httpRefreshExchange: refresh_token grant', async () => {
  const m = mockFetch({ access_token: 'AT2', refresh_token: 'RT2' });
  const refresh = httpRefreshExchange(m.fetch);
  const out = await refresh({ refreshToken: 'old-RT', clientId: 'byo-client' });
  assert.deepEqual(out, { accessToken: 'AT2', refreshToken: 'RT2' });
  assert.match(m.calls[0]?.body ?? '', /grant_type=refresh_token/);
  assert.match(m.calls[0]?.body ?? '', /refresh_token=old-RT/);
});

test('httpIdentity: GET /2/users/me with Bearer -> id/username/verified/createdAtMs', async () => {
  const m = mockFetch({ data: { id: '42', username: 'acme', verified: true, created_at: '2011-06-09T12:00:00.000Z' } });
  const who = await httpIdentity(m.fetch)('AT');
  assert.deepEqual(who, { xUserId: '42', username: 'acme', verified: true, createdAtMs: Date.parse('2011-06-09T12:00:00.000Z') });
  assert.equal(m.calls[0]?.method, 'GET');
  assert.equal(m.calls[0]?.headers.authorization, 'Bearer AT');
  // the user.fields param is what makes X return verified/created_at at all — without it they're absent
  assert.match(m.calls[0]?.url ?? '', /user\.fields=verified,created_at/);
});

test('httpIdentity FAILS CLOSED when X omits verified/created_at', async () => {
  // If the app's access tier doesn't grant these fields, an unknown-age account must NOT be able to
  // schedule autonomous posts: createdAtMs 0 => ageDays 0 => casserole L1 blocks Loops. Manual posting
  // is unaffected (L1 only gates when ctx.loop is set).
  const m = mockFetch({ data: { id: '42', username: 'acme' } });
  const who = await httpIdentity(m.fetch)('AT');
  assert.equal(who.verified, false);
  assert.equal(who.createdAtMs, 0);
});

test('token exchange throws on a non-2xx and on missing tokens', async () => {
  const bad = mockFetch({ error: 'invalid_grant' }, false, 400);
  await assert.rejects(() => httpTokenExchange(bad.fetch, { redirectUri: 'x' })({ code: 'c', verifier: 'v', clientId: 'c1' }), /400/);
  const empty = mockFetch({ token_type: 'bearer' }); // 200 but no tokens
  await assert.rejects(() => httpTokenExchange(empty.fetch, { redirectUri: 'x' })({ code: 'c', verifier: 'v', clientId: 'c1' }), /missing/);
});
