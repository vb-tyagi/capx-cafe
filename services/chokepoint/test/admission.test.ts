import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryStore } from '../src/store/memory.ts';
import { HmacSessionSigner } from '../src/admission/session.ts';
import { Admission } from '../src/admission/index.ts';

const TTL = 15 * 60_000; // 15 min
const GRACE = 12 * 60 * 60_000; // 12 h
const NOW = 1_700_000_000_000;

function make() {
  const store = new InMemoryStore();
  const signer = new HmacSessionSigner('test-signing-key', TTL, GRACE);
  return { store, admission: new Admission(store, signer) };
}

test('allowlisted + live session is admitted', async () => {
  const { store, admission } = make();
  await store.addAllowlisted('h_abc');
  const r = await admission.admit(admission.issueSession('h_abc', NOW), NOW + 1000);
  assert.equal(r.admitted, true);
  assert.equal(r.emailHash, 'h_abc');
  assert.equal(r.inGrace, false);
});

test('not-allowlisted is denied', async () => {
  const { admission } = make();
  const r = await admission.admit(admission.issueSession('h_x', NOW), NOW + 1000);
  assert.equal(r.admitted, false);
  assert.match(r.reason ?? '', /not allowlisted/);
});

test('expired-but-in-grace is admitted; past-grace is denied', async () => {
  const { store, admission } = make();
  await store.addAllowlisted('h_abc');
  const bearer = admission.issueSession('h_abc', NOW);
  const inGrace = await admission.admit(bearer, NOW + TTL + 1000);
  assert.equal(inGrace.admitted, true);
  assert.equal(inGrace.inGrace, true);
  const pastGrace = await admission.admit(bearer, NOW + TTL + GRACE + 1000);
  assert.equal(pastGrace.admitted, false);
  assert.match(pastGrace.reason ?? '', /expired/);
});

test('tampered signature is denied', async () => {
  const { store, admission } = make();
  await store.addAllowlisted('h_abc');
  const bearer = admission.issueSession('h_abc', NOW);
  const forged = bearer.slice(0, -2) + (bearer.endsWith('aa') ? 'bb' : 'aa');
  const r = await admission.admit(forged, NOW + 1000);
  assert.equal(r.admitted, false);
  assert.match(r.reason ?? '', /signature/);
});

test('global kill-switch denies admission', async () => {
  const { store, admission } = make();
  await store.addAllowlisted('h_abc');
  await admission.revoke({ global: true });
  const r = await admission.admit(admission.issueSession('h_abc', NOW), NOW + 1000);
  assert.equal(r.admitted, false);
  assert.match(r.reason ?? '', /global kill/);
});

test('resolveKillSwitch reflects revoke in casserole {global,handle} shape', async () => {
  const { admission } = make();
  assert.deepEqual(await admission.resolveKillSwitch('h_abc'), { global: false, handle: false });
  await admission.revoke({ handleKey: 'h_abc' });
  assert.deepEqual(await admission.resolveKillSwitch('h_abc'), { global: false, handle: true });
  await admission.revoke({ global: true });
  assert.deepEqual(await admission.resolveKillSwitch('h_abc'), { global: true, handle: true });
});

test('ingestAllowlist: bad signature throws, good adds (MoR stub)', async () => {
  const { store, admission } = make();
  await assert.rejects(() => admission.ingestAllowlist('h_new', false));
  assert.equal(await store.isAllowlisted('h_new'), false);
  await admission.ingestAllowlist('h_new', true);
  assert.equal(await store.isAllowlisted('h_new'), true);
});
