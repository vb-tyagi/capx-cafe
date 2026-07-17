import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryStore } from '../src/store/memory.ts';
import { LocalKeyKms } from '../src/vault/kms.ts';
import { Vault } from '../src/vault/index.ts';
import { HmacSessionSigner } from '../src/admission/session.ts';
import { Admission } from '../src/admission/index.ts';
import { PublishGate } from '../src/gate/index.ts';
import { XAdapter, httpXPoster } from '../src/xclient/index.ts';
import type { FetchLike, XPoster } from '../src/xclient/index.ts';

const NOW = 1_700_000_000_000;
const CLEAN =
  'Shipping the anti-slop engine today: deterministic scoring, real unit tests, and zero external keys. Here is a concrete walkthrough of the pipeline.';

async function vaultWithConn() {
  const store = new InMemoryStore();
  const kms = new LocalKeyKms(LocalKeyKms.generateMasterKey());
  const vault = new Vault(store, kms, () => NOW);
  const ref = await vault.put(
    { emailHash: 'h_abc', xUserId: 'x1', username: 'acme', lane: 'BYO', standing: 'GOOD', verified: true, createdAtMs: 1_600_000_000_000 },
    { access: 'the-real-access-token', refresh: 'the-real-refresh-token' },
  );
  return { store, vault, ref };
}

test('XAdapter resolves vaultRef -> decrypted token inside withToken, returns tweet id', async () => {
  const { vault, ref } = await vaultWithConn();
  let seenToken = '';
  const post: XPoster = async ({ accessToken, text }) => {
    seenToken = accessToken;
    assert.equal(text, 'hello world');
    return { id: 'tweet-42' };
  };
  const adapter = new XAdapter({ vault, post });
  const r = await adapter.publish({ channelId: ref, text: 'hello world', scheduledAtMs: NOW, aiLabel: false });
  assert.equal(r.platformPostId, 'tweet-42');
  assert.equal(seenToken, 'the-real-access-token', 'the adapter passed the DECRYPTED token to the poster');
});

test('XAdapter on an unknown vaultRef throws (no connection)', async () => {
  const { vault } = await vaultWithConn();
  const adapter = new XAdapter({ vault, post: async () => ({ id: 'x' }) });
  await assert.rejects(() => adapter.publish({ channelId: 'nope', text: 't', scheduledAtMs: NOW, aiLabel: false }));
});

test('httpXPoster sends a Bearer POST /2/tweets and parses the id', async () => {
  const calls: Array<{ url: string; headers: Record<string, string>; body?: string }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, headers: init.headers, body: init.body });
    return { ok: true, status: 200, json: async () => ({ data: { id: '99' } }), text: async () => '' };
  };
  const poster = httpXPoster(fetchImpl);
  const out = await poster({ accessToken: 'tok-xyz', text: 'gm' });
  assert.equal(out.id, '99');
  assert.equal(calls[0]?.headers.authorization, 'Bearer tok-xyz');
  assert.match(calls[0]?.body ?? '', /"text":"gm"/);
});

test('httpXPoster throws on a non-2xx from X', async () => {
  const fetchImpl: FetchLike = async () => ({ ok: false, status: 403, json: async () => ({}), text: async () => 'forbidden' });
  await assert.rejects(() => httpXPoster(fetchImpl)({ accessToken: 't', text: 'x' }), /403/);
});

test('END-TO-END: gate + XAdapter publishes a clean post using the vaulted token', async () => {
  const { store, vault, ref } = await vaultWithConn();
  await store.addAllowlisted('h_abc');
  const admission = new Admission(store, new HmacSessionSigner('sign-key', 15 * 60_000, 12 * 60 * 60_000));
  let seenToken = '';
  const adapter = new XAdapter({ vault, post: async ({ accessToken }) => { seenToken = accessToken; return { id: 't-1' }; } });
  const gate = new PublishGate({ admission, vault, client: adapter, now: () => NOW });
  const r = await gate.postNow({ bearer: admission.issueSession('h_abc', NOW), text: CLEAN, aiGenerated: true, idempotencyKey: 'k' });
  assert.equal(r.outcome, 'published');
  assert.equal(r.platformPostId, 't-1');
  assert.equal(seenToken, 'the-real-access-token');
  assert.equal(await vault.refByEmailHash('h_abc'), ref);
});

test('END-TO-END: a blocked post NEVER decrypts the token (poster not called)', async () => {
  const { store, vault } = await vaultWithConn();
  await store.addAllowlisted('h_abc');
  const admission = new Admission(store, new HmacSessionSigner('sign-key', 15 * 60_000, 12 * 60 * 60_000));
  let posterCalled = false;
  const adapter = new XAdapter({ vault, post: async () => { posterCalled = true; return { id: 'nope' }; } });
  const gate = new PublishGate({ admission, vault, client: adapter, now: () => NOW });
  const spam = 'RT if you agree!!!! 🚀🚀🚀🚀🚀 #a #b #c #d #e #f #g #h #i';
  const r = await gate.postNow({ bearer: admission.issueSession('h_abc', NOW), text: spam, aiGenerated: true, idempotencyKey: 'k' });
  assert.equal(r.outcome, 'blocked');
  assert.equal(posterCalled, false, 'casserole blocked before the token was ever decrypted');
});
