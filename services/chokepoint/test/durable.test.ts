import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryStore } from '../src/store/memory.ts';
import { LocalKeyKms } from '../src/vault/kms.ts';
import { Vault } from '../src/vault/index.ts';
import { HmacSessionSigner } from '../src/admission/session.ts';
import { Admission } from '../src/admission/index.ts';
import { RecentPosts } from '../src/recent/index.ts';
import { Outbox } from '../src/outbox/index.ts';
import { PublishGate } from '../src/gate/index.ts';
import { XAdapter } from '../src/xclient/index.ts';

const NOW = 1_700_000_000_000;
const CLEAN =
  'Shipping the anti-slop engine today: deterministic scoring, real unit tests, and zero external keys. Here is a concrete walkthrough of the pipeline.';

async function makeGate(opts: { failFirst?: boolean } = {}) {
  const store = new InMemoryStore();
  const kms = new LocalKeyKms(LocalKeyKms.generateMasterKey());
  const vault = new Vault(store, kms, () => NOW);
  await store.addAllowlisted('h_abc');
  await vault.put({ emailHash: 'h_abc', xUserId: 'x1', username: 'acme', lane: 'BYO', standing: 'GOOD', verified: true, createdAtMs: 1_600_000_000_000 }, { access: 'a', refresh: 'r' });
  const admission = new Admission(store, new HmacSessionSigner('s', 15 * 60_000, 12 * 60 * 60_000));
  let calls = 0;
  const post = async () => {
    calls += 1;
    if (opts.failFirst && calls === 1) throw new Error('X 5xx');
    return { id: `tw-${calls}` };
  };
  const gate = new PublishGate({
    admission,
    vault,
    client: new XAdapter({ vault, post }),
    now: () => NOW,
    recentPosts: new RecentPosts(store),
    outbox: new Outbox(store),
  });
  return { gate, bearer: admission.issueSession('h_abc', NOW), calls: () => calls };
}

test('a retried post_now with the same idempotency key does NOT double-send', async () => {
  const { gate, bearer, calls } = await makeGate();
  const r1 = await gate.postNow({ bearer, text: CLEAN, aiGenerated: true, idempotencyKey: 'k1' });
  assert.equal(r1.outcome, 'published');
  assert.equal(calls(), 1);

  const r2 = await gate.postNow({ bearer, text: CLEAN, aiGenerated: true, idempotencyKey: 'k1' });
  assert.equal(r2.outcome, 'published');
  assert.match(r2.finalReasons.join(' '), /idempotent replay/);
  assert.equal(calls(), 1, 'the second call did not reach X again');
});

test('a failed send can be retried with the same key (not stuck)', async () => {
  const { gate, bearer, calls } = await makeGate({ failFirst: true });
  const failed = await gate.postNow({ bearer, text: CLEAN, aiGenerated: true, idempotencyKey: 'k1' });
  assert.equal(failed.outcome, 'publish_failed');
  assert.equal(calls(), 1);

  // same key, but the prior attempt is PUBLISH_FAILED (not SENT) -> it retries and succeeds.
  const retry = await gate.postNow({ bearer, text: CLEAN, aiGenerated: true, idempotencyKey: 'k1' });
  assert.equal(retry.outcome, 'published');
  assert.equal(calls(), 2);
});
