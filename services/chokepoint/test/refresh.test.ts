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
import { XAdapter } from '../src/xclient/index.ts';

const NOW = 1_700_000_000_000;
const CLEAN =
  'Shipping the anti-slop engine today: deterministic scoring, real unit tests, and zero external keys. Here is a concrete walkthrough of the pipeline.';

async function setup() {
  const store = new InMemoryStore();
  const kms = new LocalKeyKms(LocalKeyKms.generateMasterKey());
  const vault = new Vault(store, kms, () => NOW);
  const ref = await vault.put(
    { emailHash: 'h_abc', xUserId: 'x1', username: 'acme', lane: 'BYO', standing: 'GOOD' },
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
