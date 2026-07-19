import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryStore } from '../src/store/memory.ts';
import { LocalKeyKms } from '../src/vault/kms.ts';
import { Vault } from '../src/vault/index.ts';
import { Refresher } from '../src/oauth/refresh.ts';
import type { RefreshExchange } from '../src/oauth/refresh.ts';
import { HmacSessionSigner } from '../src/admission/session.ts';
import { Admission } from '../src/admission/index.ts';
import { PublishGate } from '../src/gate/index.ts';
import { XAdapter, XApiError } from '../src/xclient/index.ts';
import type { XPoster } from '../src/xclient/index.ts';
import type { LoopRecord } from '../src/loops/index.ts';

const NOW = 1_700_000_000_000;
const CLEAN =
  'Shipping the anti-slop engine today: deterministic scoring, real unit tests, and zero external keys. Here is a concrete walkthrough of the pipeline.';

async function setup() {
  const store = new InMemoryStore();
  const kms = new LocalKeyKms(LocalKeyKms.generateMasterKey());
  const vault = new Vault(store, kms, () => NOW);
  const ref = await vault.put(
    { emailHash: 'h_abc', xUserId: 'x1', username: 'acme', lane: 'BYO', standing: 'GOOD', verified: true, createdAtMs: 1_600_000_000_000 },
    { access: 'a0', refresh: 'r0' },
  );
  const refresher = new Refresher({ vault, clientId: 'client-123' });
  return { store, vault, ref, refresher };
}

test('successful refresh rotates access + refresh tokens', async () => {
  const { vault, ref, refresher } = await setup();
  let sawRefresh = '';
  const exchange: RefreshExchange = async ({ refreshToken }) => {
    sawRefresh = refreshToken;
    return { accessToken: 'a1', refreshToken: 'r1' };
  };
  const r = await refresher.refresh(ref, exchange);
  assert.deepEqual(r, { ok: true });
  assert.equal(sawRefresh, 'r0', 'exchange received the CURRENT (decrypted) refresh token');
  assert.equal(await vault.withToken(ref, async (t) => t), 'a1');
  assert.equal(await vault.withRefreshToken(ref, async (t) => t), 'r1');
});

test('invalid_grant flags the connection needs-reauth (no silent brick)', async () => {
  const { vault, ref, refresher } = await setup();
  const failing: RefreshExchange = async () => {
    throw new Error('invalid_grant');
  };
  const r = await refresher.refresh(ref, failing);
  assert.equal(r.ok, false);
  assert.equal(await vault.needsReauth(ref), true);
  // a subsequent refresh short-circuits (already flagged) and does not call exchange again
  const r2 = await refresher.refresh(ref, async () => {
    throw new Error('should not be called');
  });
  assert.equal(r2.ok, false);
});

test('a needs-reauth connection is rejected at the publish gate', async () => {
  const { store, vault, ref, refresher } = await setup();
  await store.addAllowlisted('h_abc');
  await refresher.refresh(ref, async () => {
    throw new Error('invalid_grant');
  });
  const admission = new Admission(store, new HmacSessionSigner('sign-key', 15 * 60_000, 12 * 60 * 60_000));
  const gate = new PublishGate({ admission, vault, client: new XAdapter({ vault, post: async () => ({ id: 'x' }) }), now: () => NOW });
  const r = await gate.postNow({ bearer: admission.issueSession('h_abc', NOW), text: CLEAN, aiGenerated: true, idempotencyKey: 'k' });
  assert.equal(r.outcome, 'rejected');
  assert.match(r.finalReasons.join(' '), /re-auth/);
});

test('concurrent refreshes serialize — the one-time refresh token is never double-spent', async () => {
  const { ref, refresher } = await setup();
  const seen: string[] = [];
  // each refresh derives the next token from the one it saw; if two ran on the same input, we'd see r0 twice.
  const exchange: RefreshExchange = async ({ refreshToken }) => {
    seen.push(refreshToken);
    return { accessToken: `a-${refreshToken}`, refreshToken: `next-${refreshToken}` };
  };
  await Promise.all([refresher.refresh(ref, exchange), refresher.refresh(ref, exchange)]);
  assert.deepEqual(seen, ['r0', 'next-r0'], 'second refresh saw the ROTATED token, not a re-read of r0');
});

// --- Refresh-on-401 at the publish gate (the GA-blocking fix: expired X access tokens ~2h after connect) ---

// A gate wired with a Refresher + injected RefreshExchange, over an XAdapter whose poster is controllable.
// The connection carries its OWN client id ('byo-client-A') to prove the refresh uses it, not the default.
async function gateWithRefresh(o: { poster: XPoster; exchange: RefreshExchange; clientId?: string }) {
  const store = new InMemoryStore();
  const kms = new LocalKeyKms(LocalKeyKms.generateMasterKey());
  const vault = new Vault(store, kms, () => NOW);
  const ref = await vault.put(
    { emailHash: 'h_abc', xUserId: 'x1', username: 'acme', lane: 'BYO', standing: 'GOOD', verified: true, createdAtMs: 1_600_000_000_000, clientId: o.clientId ?? 'byo-client-A' },
    { access: 'a0', refresh: 'r0' },
  );
  await store.addAllowlisted('h_abc');
  const admission = new Admission(store, new HmacSessionSigner('sign-key', 15 * 60_000, 12 * 60 * 60_000));
  const refresher = new Refresher({ vault, clientId: 'default-client' });
  const gate = new PublishGate({
    admission,
    vault,
    client: new XAdapter({ vault, post: o.poster }),
    now: () => NOW,
    refresher,
    refreshExchange: o.exchange,
  });
  return { store, vault, ref, admission, gate, bearer: admission.issueSession('h_abc', NOW) };
}

test('a publish that 401s refreshes THIS connection then retries once and succeeds', async () => {
  let calls = 0;
  const seenTokens: string[] = [];
  let refreshClientId = '';
  const poster: XPoster = async ({ accessToken }) => {
    calls += 1;
    seenTokens.push(accessToken);
    if (calls === 1) throw new XApiError(401, 'Unauthorized', 'X /2/tweets failed: 401 Unauthorized');
    return { id: 'tweet-after-refresh' };
  };
  const exchange: RefreshExchange = async ({ refreshToken, clientId }) => {
    assert.equal(refreshToken, 'r0', 'refresh used the CURRENT (decrypted) refresh token');
    refreshClientId = clientId;
    return { accessToken: 'a1', refreshToken: 'r1' };
  };
  const { gate, vault, ref, bearer } = await gateWithRefresh({ poster, exchange, clientId: 'byo-client-A' });

  const r = await gate.postNow({ bearer, text: CLEAN, aiGenerated: false, idempotencyKey: 'k1' });
  assert.equal(r.outcome, 'published');
  assert.equal(r.platformPostId, 'tweet-after-refresh');
  assert.equal(calls, 2, 'sent once (401), refreshed, retried exactly once');
  assert.deepEqual(seenTokens, ['a0', 'a1'], 'the retry used the freshly-rotated access token');
  assert.equal(refreshClientId, 'byo-client-A', "refreshed with THIS connection's client id, not the server default");
  assert.equal(await vault.withToken(ref, async (t) => t), 'a1', 'vault rotated to the new access token');
});

test('a 401 whose refresh invalid_grants marks needs-reauth and rejects (no retry)', async () => {
  let calls = 0;
  const poster: XPoster = async () => {
    calls += 1;
    throw new XApiError(401, 'Unauthorized', 'X /2/tweets failed: 401 Unauthorized');
  };
  const exchange: RefreshExchange = async () => {
    throw new Error('invalid_grant');
  };
  const { gate, vault, ref, bearer } = await gateWithRefresh({ poster, exchange });

  const r = await gate.postNow({ bearer, text: CLEAN, aiGenerated: false, idempotencyKey: 'k1' });
  assert.equal(r.outcome, 'rejected');
  assert.match(r.finalReasons.join(' '), /re-auth/);
  assert.equal(calls, 1, 'the send is not retried after a failed refresh');
  assert.equal(await vault.needsReauth(ref), true, 'the connection is flagged dead until re-auth');
});

test('a non-auth publish failure surfaces the REAL X error and does NOT refresh', async () => {
  let refreshed = false;
  const poster: XPoster = async () => {
    throw new XApiError(500, 'upstream boom', 'X /2/tweets failed: 500 upstream boom');
  };
  const exchange: RefreshExchange = async () => {
    refreshed = true;
    return { accessToken: 'a1', refreshToken: 'r1' };
  };
  const { gate, bearer } = await gateWithRefresh({ poster, exchange });

  const r = await gate.postNow({ bearer, text: CLEAN, aiGenerated: false, idempotencyKey: 'k1' });
  assert.equal(r.outcome, 'publish_failed');
  assert.match(r.finalReasons.join(' '), /500/, 'the real HTTP status is surfaced');
  assert.match(r.finalReasons.join(' '), /upstream boom/, 'the real X error body is surfaced, not a generic message');
  assert.equal(refreshed, false, 'a non-401 failure never triggers a token refresh');
});

test('LOOPS get the same refresh-on-401 (postFromLoop shares the #publish send path)', async () => {
  let calls = 0;
  const seenTokens: string[] = [];
  const poster: XPoster = async ({ accessToken }) => {
    calls += 1;
    seenTokens.push(accessToken);
    if (calls === 1) throw new XApiError(401, 'Unauthorized', 'X /2/tweets failed: 401 Unauthorized');
    return { id: 'loop-tweet' };
  };
  const exchange: RefreshExchange = async () => ({ accessToken: 'a1', refreshToken: 'r1' });
  const { gate } = await gateWithRefresh({ poster, exchange });
  const loop: LoopRecord = {
    id: 'loop-1',
    emailHash: 'h_abc',
    timezone: 'UTC',
    timeOfDayMinutes: 540,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    buffer: [],
    autonomy: 'AUTONOMOUS',
    trainingWheelsRemaining: 0,
    paused: false,
    createdAtMs: 1_600_000_000_000,
    aiGenerated: false,
  };

  const r = await gate.postFromLoop({ emailHash: 'h_abc', loop, text: CLEAN, idempotencyKey: 'lk1', now: NOW });
  assert.equal(r.outcome, 'published');
  assert.equal(r.platformPostId, 'loop-tweet');
  assert.deepEqual(seenTokens, ['a0', 'a1'], 'the loop send refreshed and retried with the new token');
});
