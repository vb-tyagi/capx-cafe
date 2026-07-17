import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryStore } from '../src/store/memory.ts';
import { LocalKeyKms } from '../src/vault/kms.ts';
import { Vault } from '../src/vault/index.ts';
import { HmacSessionSigner } from '../src/admission/session.ts';
import { Admission } from '../src/admission/index.ts';
import { Metering } from '../src/metering/index.ts';
import { PublishGate } from '../src/gate/index.ts';
import { XAdapter } from '../src/xclient/index.ts';
import type { Lane } from '@capx/core';

const NOW = 1_700_000_000_000;
const CLEAN =
  'Shipping the anti-slop engine today: deterministic scoring, real unit tests, and zero external keys. Here is a concrete walkthrough of the pipeline.';

async function gateFor(lane: Lane, cap: number) {
  const store = new InMemoryStore();
  const kms = new LocalKeyKms(LocalKeyKms.generateMasterKey());
  const vault = new Vault(store, kms, () => NOW);
  await store.addAllowlisted('h_abc');
  await vault.put({ emailHash: 'h_abc', xUserId: 'x1', username: 'acme', lane, standing: 'GOOD' }, { access: 'a', refresh: 'r' });
  const admission = new Admission(store, new HmacSessionSigner('sign', 15 * 60_000, 12 * 60 * 60_000));
  const gate = new PublishGate({ admission, vault, client: new XAdapter({ vault, post: async () => ({ id: 'tw' }) }), now: () => NOW, metering: new Metering(store, cap) });
  return { gate, bearer: admission.issueSession('h_abc', NOW) };
}

test('Metering.check tracks the daily count against the cap', async () => {
  const m = new Metering(new InMemoryStore(), 2);
  assert.equal((await m.check('h', NOW)).allowed, true);
  await m.record('h', NOW);
  await m.record('h', NOW);
  const at = await m.check('h', NOW);
  assert.equal(at.allowed, false);
  assert.deepEqual({ used: at.used, cap: at.cap }, { used: 2, cap: 2 });
});

test('capx-app lane is capped: sends beyond the daily cap are rejected', async () => {
  const { gate, bearer } = await gateFor('CAPX_APP', 2);
  const p = (k: string) => gate.postNow({ bearer, text: CLEAN, aiGenerated: true, idempotencyKey: k });
  assert.equal((await p('k1')).outcome, 'published');
  assert.equal((await p('k2')).outcome, 'published');
  const third = await p('k3');
  assert.equal(third.outcome, 'rejected');
  assert.match(third.finalReasons.join(' '), /capx-app daily cap/);
});

test('BYO lane is uncapped: metering is ignored', async () => {
  const { gate, bearer } = await gateFor('BYO', 2);
  const p = (k: string) => gate.postNow({ bearer, text: CLEAN, aiGenerated: true, idempotencyKey: k });
  assert.equal((await p('k1')).outcome, 'published');
  assert.equal((await p('k2')).outcome, 'published');
  assert.equal((await p('k3')).outcome, 'published'); // no cap on BYO — user pays X directly
});
