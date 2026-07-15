import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakePlatformClient } from '@capx/platform-client';
import type { PlatformClient, PublishResult } from '@capx/platform-client';
import { InMemoryStore } from '../src/store/memory.ts';
import { LocalKeyKms } from '../src/vault/kms.ts';
import { Vault } from '../src/vault/index.ts';
import { HmacSessionSigner } from '../src/admission/session.ts';
import { Admission } from '../src/admission/index.ts';
import { PublishGate } from '../src/gate/index.ts';

const NOW = 1_700_000_000_000;
// A text known to pass the full gauntlet (mirrors casserole's clean-post fixture).
const CLEAN =
  'Shipping the anti-slop engine today: deterministic scoring, real unit tests, and zero external keys. Here is a concrete walkthrough of the pipeline.';

async function setup(o: { connected?: boolean } = {}) {
  const store = new InMemoryStore();
  const kms = new LocalKeyKms(LocalKeyKms.generateMasterKey());
  const vault = new Vault(store, kms, () => NOW);
  const admission = new Admission(store, new HmacSessionSigner('sign-key', 15 * 60_000, 12 * 60 * 60_000));
  await store.addAllowlisted('h_abc');
  if (o.connected ?? true) {
    await vault.put({ emailHash: 'h_abc', xUserId: 'x1', username: 'acme', lane: 'BYO', standing: 'GOOD' }, { access: 'atok', refresh: 'rtok' });
  }
  const client = new FakePlatformClient();
  const gate = new PublishGate({ admission, vault, client, now: () => NOW });
  return { store, admission, vault, client, gate, bearer: admission.issueSession('h_abc', NOW) };
}

const req = (text: string, bearer: string, aiGenerated = false) => ({ bearer, text, aiGenerated, idempotencyKey: 'k1' });

test('clean text publishes exactly once through the adapter', async () => {
  const { gate, client, bearer } = await setup();
  const r = await gate.postNow(req(CLEAN, bearer));
  assert.equal(r.outcome, 'published');
  assert.equal(r.verdict, 'PASS');
  assert.equal(client.calls.length, 1);
  assert.ok(r.platformPostId);
});

test('the adapter receives channelId = vaultRef (token never crosses the gate)', async () => {
  const { gate, client, vault, bearer } = await setup();
  await gate.postNow(req(CLEAN, bearer));
  assert.equal(client.calls[0]?.channelId, await vault.refByEmailHash('h_abc'));
});

test('over-length text is rejected before casserole; 0 sends', async () => {
  const { gate, client, bearer } = await setup();
  const r = await gate.postNow(req('x'.repeat(281), bearer));
  assert.equal(r.outcome, 'rejected');
  assert.match(r.finalReasons.join(' '), /exceeds 280/);
  assert.equal(client.calls.length, 0);
});

test('handle kill-switch blocks at casserole; 0 sends', async () => {
  const { gate, admission, client, bearer } = await setup();
  await admission.revoke({ handleKey: 'x1' }); // keyed on xUserId
  const r = await gate.postNow(req(CLEAN, bearer));
  assert.equal(r.outcome, 'blocked');
  assert.equal(client.calls.length, 0);
});

test('global kill-switch is caught at admission; 0 sends', async () => {
  const { gate, admission, client, bearer } = await setup();
  await admission.revoke({ global: true });
  const r = await gate.postNow(req(CLEAN, bearer));
  assert.equal(r.outcome, 'rejected');
  assert.match(r.finalReasons.join(' '), /global kill/);
  assert.equal(client.calls.length, 0);
});

test('invalid session is rejected; 0 sends', async () => {
  const { gate, client } = await setup();
  const r = await gate.postNow(req('hello', 'garbage.sig'));
  assert.equal(r.outcome, 'rejected');
  assert.equal(client.calls.length, 0);
});

test('not connected (allowlisted, no vault row) is rejected', async () => {
  const { gate, client, bearer } = await setup({ connected: false });
  const r = await gate.postNow(req(CLEAN, bearer));
  assert.equal(r.outcome, 'rejected');
  assert.match(r.finalReasons.join(' '), /connect_x/);
  assert.equal(client.calls.length, 0);
});

test('spammy text (>8 hashtags + bait) is blocked by casserole; 0 sends', async () => {
  const { gate, client, bearer } = await setup();
  const spam = 'RT if you agree!!!! 🚀🚀🚀🚀🚀 #a #b #c #d #e #f #g #h #i';
  const r = await gate.postNow(req(spam, bearer));
  assert.equal(r.outcome, 'blocked');
  assert.equal(client.calls.length, 0);
});

test('a failing x-adapter yields publish_failed, not a throw', async () => {
  const store = new InMemoryStore();
  const kms = new LocalKeyKms(LocalKeyKms.generateMasterKey());
  const vault = new Vault(store, kms, () => NOW);
  const admission = new Admission(store, new HmacSessionSigner('sign-key', 15 * 60_000, 12 * 60 * 60_000));
  await store.addAllowlisted('h_abc');
  await vault.put({ emailHash: 'h_abc', xUserId: 'x1', username: 'acme', lane: 'BYO', standing: 'GOOD' }, { access: 'a', refresh: 'r' });
  const throwing: PlatformClient = { publish: async (): Promise<PublishResult> => { throw new Error('X 5xx'); } };
  const gate = new PublishGate({ admission, vault, client: throwing, now: () => NOW });
  const r = await gate.postNow(req(CLEAN, admission.issueSession('h_abc', NOW)));
  assert.equal(r.outcome, 'publish_failed');
});
