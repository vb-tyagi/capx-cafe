import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalKeyKms } from '../src/vault/kms.ts';
import { Vault } from '../src/vault/index.ts';
import { InMemoryStore } from '../src/store/memory.ts';

function makeVault() {
  const kms = new LocalKeyKms(LocalKeyKms.generateMasterKey());
  const store = new InMemoryStore();
  const vault = new Vault(store, kms, () => 1_700_000_000_000);
  return { vault, store };
}
const META = { emailHash: 'h_abc', xUserId: 'x123', username: 'acme', lane: 'BYO' as const, standing: 'GOOD' as const };
const TOKENS = { access: 'access-SECRET-tok', refresh: 'refresh-SECRET-tok' };

test('put then getMetadata returns metadata, NEVER a token', async () => {
  const { vault } = makeVault();
  const ref = await vault.put(META, TOKENS);
  const meta = await vault.getMetadata(ref);
  assert.ok(meta);
  assert.equal(meta.username, 'acme');
  assert.equal(meta.lane, 'BYO');
  assert.ok(!JSON.stringify(meta).includes('SECRET'), 'metadata carries no token material');
});

test('withToken decrypts the access token in-memory', async () => {
  const { vault } = makeVault();
  const ref = await vault.put(META, TOKENS);
  const seen = await vault.withToken(ref, async (tok) => tok);
  assert.equal(seen, 'access-SECRET-tok');
});

test('stored row is ciphertext-only (no plaintext token at rest)', async () => {
  const { vault, store } = makeVault();
  const ref = await vault.put(META, TOKENS);
  const row = await store.getByRef(ref);
  assert.ok(!JSON.stringify(row).includes('SECRET'), 'no plaintext token in the store');
});

test('getMetadata / withToken on an unknown ref', async () => {
  const { vault } = makeVault();
  assert.equal(await vault.getMetadata('nope'), null);
  await assert.rejects(() => vault.withToken('nope', async (t) => t));
});

test('rotate replaces the tokens', async () => {
  const { vault } = makeVault();
  const ref = await vault.put(META, TOKENS);
  await vault.rotate(ref, { access: 'access-NEW', refresh: 'refresh-NEW' });
  assert.equal(await vault.withToken(ref, async (t) => t), 'access-NEW');
});

test('refByEmailHash resolves the connection server-side', async () => {
  const { vault } = makeVault();
  const ref = await vault.put(META, TOKENS);
  assert.equal(await vault.refByEmailHash('h_abc'), ref);
  assert.equal(await vault.refByEmailHash('h_unknown'), null);
});
