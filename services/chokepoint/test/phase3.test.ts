// Phase-3 additions: casserole preview (dry-run), reply-chaining, the audit-read trail, and the
// Option-C per-loop aiGenerated label. All at the gate level with the in-memory store.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakePlatformClient } from '@capx-cafe/platform-client';
import { InMemoryStore } from '../src/store/memory.ts';
import { LocalKeyKms } from '../src/vault/kms.ts';
import { Vault } from '../src/vault/index.ts';
import { HmacSessionSigner } from '../src/admission/session.ts';
import { Admission } from '../src/admission/index.ts';
import { PublishGate } from '../src/gate/index.ts';
import { Outbox } from '../src/outbox/index.ts';
import { RecentPosts } from '../src/recent/index.ts';
import { Loops } from '../src/loops/index.ts';

const NOW = 1_700_000_000_000;
const CLEAN =
  'Shipping the anti-slop engine today: deterministic scoring, real unit tests, and zero external keys. Here is a concrete walkthrough of the pipeline.';

async function setup() {
  const store = new InMemoryStore();
  const kms = new LocalKeyKms(LocalKeyKms.generateMasterKey());
  const vault = new Vault(store, kms, () => NOW);
  const admission = new Admission(store, new HmacSessionSigner('sign-key', 15 * 60_000, 12 * 60 * 60_000));
  await store.addAllowlisted('h_abc');
  await vault.put(
    { emailHash: 'h_abc', xUserId: 'x1', username: 'acme', lane: 'BYO', standing: 'GOOD', verified: true, createdAtMs: 1_600_000_000_000 },
    { access: 'atok', refresh: 'rtok' },
  );
  const client = new FakePlatformClient();
  const outbox = new Outbox(store);
  const recentPosts = new RecentPosts(store);
  const gate = new PublishGate({ admission, vault, client, now: () => NOW, outbox, recentPosts });
  return { store, admission, vault, client, gate, bearer: admission.issueSession('h_abc', NOW) };
}

test('preview: a clean draft would send, and preview records/sends nothing', async () => {
  const { gate, client, bearer } = await setup();
  const p = await gate.preview({ bearer, text: CLEAN });
  assert.equal(p.wouldSend, true);
  assert.equal(p.verdict, 'PASS');
  assert.equal(client.calls.length, 0, 'preview must not publish');
  assert.equal((await gate.audit({ bearer })).entries.length, 0, 'preview must not record');
});

test('preview: an over-length draft would NOT send and returns reasons', async () => {
  const { gate, bearer } = await setup();
  const tooLong = 'a '.repeat(200); // ~400 chars, past X's 280 weighted limit
  const p = await gate.preview({ bearer, text: tooLong });
  assert.equal(p.wouldSend, false);
  assert.ok(p.finalReasons.length > 0, 'a blocked preview must explain why');
});

test('preview: an unadmitted bearer is rejected, not evaluated', async () => {
  const { gate } = await setup();
  const p = await gate.preview({ bearer: 'bogus', text: CLEAN });
  assert.equal(p.wouldSend, false);
  assert.ok(p.rejected);
});

test('reply-chain: inReplyToId reaches the platform client verbatim', async () => {
  const { gate, client, bearer } = await setup();
  await gate.postNow({ bearer, text: CLEAN, aiGenerated: false, idempotencyKey: 'k1', inReplyToId: 'parent-99' });
  assert.equal(client.calls[0]?.inReplyToId, 'parent-99');
});

test('audit: a sent post appears in the caller history with SENT state', async () => {
  const { gate, bearer } = await setup();
  await gate.postNow({ bearer, text: CLEAN, aiGenerated: false, idempotencyKey: 'k1' });
  const a = await gate.audit({ bearer });
  assert.equal(a.entries.length, 1);
  assert.equal(a.entries[0]?.state, 'SENT');
  assert.equal(a.entries[0]?.idempotencyKey, 'k1');
});

test('audit: an unadmitted bearer gets an empty, rejected result (no leak)', async () => {
  const { gate } = await setup();
  const a = await gate.audit({ bearer: 'bogus' });
  assert.equal(a.entries.length, 0);
  assert.ok(a.rejected);
});

test('loops: Option-C aiGenerated is stored per loop and defaults false', async () => {
  const { store } = await setup();
  const loops = new Loops(store, () => NOW);
  const labelled = await loops.create({ emailHash: 'h_abc', timezone: 'Asia/Kolkata', timeOfDayMinutes: 540, daysOfWeek: [1, 2, 3], posts: [CLEAN], aiGenerated: true });
  assert.equal(labelled.loop?.aiGenerated, true);
  const roundTrip = await loops.get(labelled.loop!.id);
  assert.equal(roundTrip?.aiGenerated, true, 'the choice must survive a store round-trip');
  const unlabelled = await loops.create({ emailHash: 'h_abc', timezone: 'Asia/Kolkata', timeOfDayMinutes: 540, daysOfWeek: [1, 2, 3], posts: [CLEAN] });
  assert.equal(unlabelled.loop?.aiGenerated, false, 'default is opt-in (false)');
});
