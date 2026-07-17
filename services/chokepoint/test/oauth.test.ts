import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryStore } from '../src/store/memory.ts';
import { OAuthFlow } from '../src/oauth/index.ts';
import type { TokenExchange, IdentityFetch } from '../src/oauth/index.ts';
import { challengeS256 } from '../src/oauth/pkce.ts';

const NOW = 1_700_000_000_000;
const CFG = {
  authorizeEndpoint: 'https://x.example/oauth2/authorize',
  redirectUri: 'https://capx.example/oauth/callback',
  scope: 'tweet.read tweet.write users.read offline.access',
  ttlMs: 10 * 60_000,
};

// Mock X: echoes the code into deterministic tokens; identity derives a stable user.
const exchange: TokenExchange = async ({ code }) => ({ accessToken: `atok-${code}`, refreshToken: `rtok-${code}` });
const identity: IdentityFetch = async (tok) => ({
  xUserId: `x-${tok}`,
  username: 'acme',
  verified: true,
  createdAtMs: 1_600_000_000_000,
});

function make() {
  const store = new InMemoryStore();
  return { store, flow: new OAuthFlow(store, CFG) };
}
const START = { lane: 'BYO' as const, clientId: 'client-123', emailHash: 'h_abc', sessionNonce: 'nonce-1', now: NOW };

test('start builds an S256 consent URL and stashes the verifier server-side', async () => {
  const { store, flow } = make();
  const r = await flow.start(START);
  const u = new URL(r.consentUrl);
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('state'), r.pendingId);
  assert.equal(u.searchParams.get('redirect_uri'), CFG.redirectUri);
  // PKCE binding: the URL carries challenge(verifier), never the verifier itself.
  const pending = await store.getPending(r.pendingId);
  assert.ok(pending);
  assert.equal(u.searchParams.get('code_challenge'), challengeS256(pending.verifier));
  assert.ok(!r.consentUrl.includes(pending.verifier), 'verifier never leaves the server');
});

test('happy path: start -> handleRedirect -> confirm releases tokens once', async () => {
  const { flow } = make();
  const { pendingId } = await flow.start(START);
  const page = await flow.handleRedirect({ state: pendingId, code: 'auth-code', now: NOW + 1000 }, exchange, identity);
  assert.equal(page.username, 'acme');
  const conn = await flow.confirm({ pendingId, sessionNonce: 'nonce-1' });
  assert.equal(conn.emailHash, 'h_abc');
  assert.equal(conn.lane, 'BYO');
  assert.equal(conn.accessToken, 'atok-auth-code');
  assert.equal(conn.username, 'acme');
  // one-time use: a second confirm fails (pending consumed)
  await assert.rejects(() => flow.confirm({ pendingId, sessionNonce: 'nonce-1' }));
});

test('handleRedirect rejects unknown and expired state', async () => {
  const { flow } = make();
  await assert.rejects(() => flow.handleRedirect({ state: 'bogus', code: 'c', now: NOW }, exchange, identity));
  const { pendingId } = await flow.start(START);
  await assert.rejects(() =>
    flow.handleRedirect({ state: pendingId, code: 'c', now: NOW + CFG.ttlMs + 1 }, exchange, identity),
  );
});

test('confirm with the wrong session nonce is rejected (account-binding)', async () => {
  const { flow } = make();
  const { pendingId } = await flow.start(START);
  await flow.handleRedirect({ state: pendingId, code: 'auth-code', now: NOW + 1000 }, exchange, identity);
  await assert.rejects(() => flow.confirm({ pendingId, sessionNonce: 'attacker-nonce' }), /session mismatch/);
});

test('confirm before consent completes is rejected', async () => {
  const { flow } = make();
  const { pendingId } = await flow.start(START);
  await assert.rejects(() => flow.confirm({ pendingId, sessionNonce: 'nonce-1' }), /not completed/);
});
