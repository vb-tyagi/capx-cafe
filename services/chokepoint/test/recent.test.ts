import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryStore } from '../src/store/memory.ts';
import { LocalKeyKms } from '../src/vault/kms.ts';
import { Vault } from '../src/vault/index.ts';
import { HmacSessionSigner } from '../src/admission/session.ts';
import { Admission } from '../src/admission/index.ts';
import { RecentPosts } from '../src/recent/index.ts';
import { PublishGate } from '../src/gate/index.ts';
import { XAdapter } from '../src/xclient/index.ts';

const NOW = 1_700_000_000_000;
const CLEAN =
  'Shipping the anti-slop engine today: deterministic scoring, real unit tests, and zero external keys. Here is a concrete walkthrough of the pipeline.';
const DIFFERENT =
  'A totally separate concrete update: wired the recent-post cache and the durable outbox, with fresh tests for each path.';

async function makeGate() {
  const store = new InMemoryStore();
  const kms = new LocalKeyKms(LocalKeyKms.generateMasterKey());
  const vault = new Vault(store, kms, () => NOW);
  await store.addAllowlisted('h_abc');
  await vault.put({ emailHash: 'h_abc', xUserId: 'x1', username: 'acme', lane: 'BYO', standing: 'GOOD' }, { access: 'a', refresh: 'r' });
  const admission = new Admission(store, new HmacSessionSigner('s', 15 * 60_000, 12 * 60 * 60_000));
  const gate = new PublishGate({ admission, vault, client: new XAdapter({ vault, post: async () => ({ id: 'tw' }) }), now: () => NOW, recentPosts: new RecentPosts(store) });
  return { gate, bearer: admission.issueSession('h_abc', NOW) };
}

test('recent-post cache makes casserole dedup enforce at the gate', async () => {
  const { gate, bearer } = await makeGate();
  const p = (text: string, k: string) => gate.postNow({ bearer, text, aiGenerated: true, idempotencyKey: k });

  const first = await p(CLEAN, 'k1');
  assert.equal(first.outcome, 'published');

  // same text again -> now blocked as a near-duplicate (history came from the cache)
  const dup = await p(CLEAN, 'k2');
  assert.equal(dup.outcome, 'blocked');
  assert.match(dup.finalReasons.join(' ').toLowerCase(), /duplicate/);

  // a genuinely different post still goes through
  const other = await p(DIFFERENT, 'k3');
  assert.equal(other.outcome, 'published');
});
