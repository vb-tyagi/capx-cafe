import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalKeyKms } from '../src/vault/kms.ts';
import { sealToken, openToken } from '../src/vault/crypto.ts';

const kms = new LocalKeyKms(LocalKeyKms.generateMasterKey());
const TOKEN = 'x-access-token-super-secret-abc123.refresh.def456';

test('seal/open round-trips the token', async () => {
  const sealed = await sealToken(TOKEN, kms);
  assert.equal(await openToken(sealed, kms), TOKEN);
});

test('sealed token contains NO plaintext (ciphertext-only at rest)', async () => {
  const sealed = await sealToken(TOKEN, kms);
  const blob = JSON.stringify(sealed);
  assert.ok(!blob.includes(TOKEN), 'no full token in the sealed blob');
  assert.ok(!blob.includes('super-secret'), 'no plaintext fragment in the sealed blob');
});

test('two seals of the same token differ (random DEK + IV)', async () => {
  const a = await sealToken(TOKEN, kms);
  const b = await sealToken(TOKEN, kms);
  assert.notEqual(a.ciphertext, b.ciphertext);
  assert.notEqual(a.wrappedDek.ciphertext, b.wrappedDek.ciphertext);
});

test('tampered ciphertext fails authentication (GCM)', async () => {
  const sealed = await sealToken(TOKEN, kms);
  const raw = Buffer.from(sealed.ciphertext, 'base64');
  raw[0] ^= 0xff;
  await assert.rejects(() => openToken({ ...sealed, ciphertext: raw.toString('base64') }, kms));
});

test('a different master key cannot open the token', async () => {
  const sealed = await sealToken(TOKEN, kms);
  const other = new LocalKeyKms(LocalKeyKms.generateMasterKey());
  await assert.rejects(() => openToken(sealed, other));
});

test('LocalKeyKms rejects a non-32-byte master key', () => {
  assert.throws(() => new LocalKeyKms(Buffer.from('short').toString('base64')));
});
