import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryChokepoint, LocalKeyKms } from '../src/index.ts';
import type { ChokepointService, ServiceRequest } from '../src/index.ts';

const NOW = 1_700_000_000_000;
const CLEAN =
  'Shipping the anti-slop engine today: deterministic scoring, real unit tests, and zero external keys. Here is a concrete walkthrough of the pipeline.';

function base() {
  const xPostCalls: Array<{ accessToken: string; text: string }> = [];
  const built = createInMemoryChokepoint({
    masterKeyBase64: LocalKeyKms.generateMasterKey(),
    signingKey: 'sign',
    adminKey: 'admin-secret',
    oauth: { authorizeEndpoint: 'https://x.example/authorize', redirectUri: 'https://capx.example/oauth/callback', scope: 'tweet.write' },
    tokenExchange: async ({ code }) => ({ accessToken: `atok-${code}`, refreshToken: `rtok-${code}` }),
    identity: async () => ({ xUserId: 'x1', username: 'acme' }),
    xPost: async ({ accessToken, text }) => {
      xPostCalls.push({ accessToken, text });
      return { id: 'tweet-1' };
    },
    byoDefaultClientId: 'client-xyz',
    now: () => NOW,
  });
  return { ...built, xPostCalls };
}

const call = (
  service: ChokepointService,
  method: string,
  path: string,
  opts: { body?: unknown; headers?: Record<string, string | undefined>; query?: Record<string, string> } = {},
) => service.handle({ method, path, query: opts.query ?? {}, body: opts.body, headers: opts.headers ?? {} } satisfies ServiceRequest);
const auth = (bearer: string) => ({ authorization: `Bearer ${bearer}` });
const obj = (b: unknown) => b as Record<string, unknown>;

/** Allowlist + run the full connect flow; returns a session bearer with a live X connection. */
async function connectBearer(b: ReturnType<typeof base>): Promise<string> {
  await b.store.addAllowlisted('h_abc');
  const bearer = String(obj((await call(b.service, 'POST', '/session', { body: { emailHash: 'h_abc' } })).body).bearer);
  const start = obj((await call(b.service, 'POST', '/oauth/start', { headers: auth(bearer), body: { lane: 'BYO' } })).body);
  await call(b.service, 'GET', '/oauth/callback', { query: { state: String(start.pendingId), code: 'abc' } });
  await call(b.service, 'POST', '/oauth/confirm', { headers: auth(bearer), body: { pendingId: start.pendingId, sessionNonce: start.sessionNonce } });
  return bearer;
}

test('healthz is up', async () => {
  const { service } = base();
  const r = await call(service, 'GET', '/healthz');
  assert.equal(r.status, 200);
  assert.equal(obj(r.body).ok, true);
});

test('END-TO-END: session -> connect (start/callback/confirm) -> whoami -> post_now', async () => {
  const { service, store, xPostCalls } = base();
  await store.addAllowlisted('h_abc');

  // 1. session
  const sess = await call(service, 'POST', '/session', { body: { emailHash: 'h_abc' } });
  assert.equal(sess.status, 200);
  const bearer = String(obj(sess.body).bearer);

  // 2. oauth start (clientId defaults to byoDefaultClientId)
  const start = await call(service, 'POST', '/oauth/start', { headers: auth(bearer), body: { lane: 'BYO' } });
  assert.equal(start.status, 200);
  const { pendingId, sessionNonce } = obj(start.body) as { pendingId: string; sessionNonce: string };
  assert.match(String(obj(start.body).consentUrl), /code_challenge_method=S256/);

  // 3. X redirects to the callback
  const cb = await call(service, 'GET', '/oauth/callback', { query: { state: pendingId, code: 'abc' } });
  assert.equal(cb.status, 200);
  assert.match(String(cb.body), /Connected @acme/);

  // 4. the initiating session confirms -> vault write
  const conf = await call(service, 'POST', '/oauth/confirm', { headers: auth(bearer), body: { pendingId, sessionNonce } });
  assert.equal(conf.status, 200);
  assert.equal(obj(conf.body).connected, true);

  // 5. whoami reflects the connection
  const who = await call(service, 'POST', '/whoami', { headers: auth(bearer) });
  assert.equal(obj(who.body).connected, true);
  assert.equal(obj(who.body).username, 'acme');
  assert.equal(obj(who.body).needsReauth, false);

  // 6. post_now publishes using the vaulted (decrypted) token
  const post = await call(service, 'POST', '/post_now', { headers: auth(bearer), body: { text: CLEAN, aiGenerated: true, idempotencyKey: 'k1' } });
  assert.equal(obj(post.body).outcome, 'published');
  assert.equal(obj(post.body).platformPostId, 'tweet-1');
  assert.equal(xPostCalls.length, 1);
  assert.equal(xPostCalls[0]?.accessToken, 'atok-abc', 'the post used the token minted during connect');
});

test('/session denies a non-allowlisted email; /oauth/start needs a bearer', async () => {
  const { service } = base();
  assert.equal((await call(service, 'POST', '/session', { body: { emailHash: 'h_evil' } })).status, 403);
  assert.equal((await call(service, 'POST', '/oauth/start', { body: { lane: 'BYO' } })).status, 401);
});

test('spammy post_now is blocked (200 with outcome=blocked)', async () => {
  const b = base();
  const bearer = await connectBearer(b);
  const spam = 'RT if you agree!!!! 🚀🚀🚀🚀🚀 #a #b #c #d #e #f #g #h #i';
  const r = await call(b.service, 'POST', '/post_now', { headers: auth(bearer), body: { text: spam, idempotencyKey: 'k' } });
  assert.equal(obj(r.body).outcome, 'blocked');
});

test('admin/revoke global kills posting; wrong admin key is 403', async () => {
  const { service, store } = base();
  await store.addAllowlisted('h_abc');
  const bearer = String(obj((await call(service, 'POST', '/session', { body: { emailHash: 'h_abc' } })).body).bearer);

  assert.equal((await call(service, 'POST', '/admin/revoke', { headers: { 'x-admin-key': 'wrong' }, body: { global: true } })).status, 403);

  const ok = await call(service, 'POST', '/admin/revoke', { headers: { 'x-admin-key': 'admin-secret' }, body: { global: true } });
  assert.equal(ok.status, 200);
  const r = await call(service, 'POST', '/post_now', { headers: auth(bearer), body: { text: CLEAN, idempotencyKey: 'k' } });
  assert.equal(obj(r.body).outcome, 'rejected');
  assert.match(String((obj(r.body).finalReasons as string[]).join(' ')), /global kill/);
});

test('unknown route is 404', async () => {
  const { service } = base();
  assert.equal((await call(service, 'GET', '/nope')).status, 404);
});
