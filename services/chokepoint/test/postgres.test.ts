// PostgresStore driver, exercised end-to-end against a pg-mem-backed Postgres (real SQL, offline).
// Covers every port method so the driver is behaviorally verified without Docker. A real-Postgres run
// is the guarded integration path (set CHOKEPOINT_TEST_DB_URL); this one always runs in `pnpm verify`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { PostgresStore, runMigrations, type SqlPool } from '../src/store/postgres.ts';
import { LocalKeyKms } from '../src/vault/kms.ts';
import { sealToken } from '../src/vault/crypto.ts';

async function freshStore(): Promise<PostgresStore> {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  const pool = new Pool() as unknown as SqlPool;
  await runMigrations(pool);
  return new PostgresStore(pool);
}

test('vault: put/get, jsonb ciphertext round-trip, rotate, needs-reauth', async () => {
  const store = await freshStore();
  const kms = new LocalKeyKms(LocalKeyKms.generateMasterKey());
  const access = await sealToken('atok', kms);
  const refresh = await sealToken('rtok', kms);
  await store.put({ vaultRef: 'v1', emailHash: 'h', xUserId: 'x1', username: 'acme', lane: 'BYO', standing: 'GOOD', access, refresh, refreshRotatedAt: 100, needsReauth: false });

  const row = await store.getByRef('v1');
  assert.ok(row);
  assert.equal(row.username, 'acme');
  assert.equal(row.access.ciphertext, access.ciphertext, 'SealedToken survives the jsonb round-trip');
  assert.equal(row.needsReauth, false);
  assert.equal((await store.getByEmailHash('h'))?.vaultRef, 'v1');

  const access2 = await sealToken('atok2', kms);
  await store.updateTokens('v1', access2, refresh, 200);
  const rotated = await store.getByRef('v1');
  assert.equal(rotated?.refreshRotatedAt, 200);
  assert.equal(rotated?.access.ciphertext, access2.ciphertext);

  await store.markNeedsReauth('v1');
  assert.equal((await store.getByRef('v1'))?.needsReauth, true);
  assert.equal(await store.getByRef('nope'), null);
});

test('admission: allowlist + global/handle kill-list', async () => {
  const store = await freshStore();
  assert.equal(await store.isAllowlisted('h'), false);
  await store.addAllowlisted('h');
  await store.addAllowlisted('h'); // idempotent
  assert.equal(await store.isAllowlisted('h'), true);

  assert.equal(await store.isGlobalKill(), false);
  await store.setGlobalKill(true);
  assert.equal(await store.isGlobalKill(), true);

  await store.setHandleKill('x1', true);
  assert.equal(await store.isHandleKill('x1'), true);
  await store.setHandleKill('x1', false);
  assert.equal(await store.isHandleKill('x1'), false);
});

test('outbox: insert/find/setState + idempotency unique', async () => {
  const store = await freshStore();
  await store.insert({ id: 'j1', idempotencyKey: 'k1', emailHash: 'h', vaultRef: 'v1', text: 'hi', aiGenerated: false, lane: 'BYO', state: 'PENDING', scheduledAtMs: 0, createdAtMs: 0 });
  assert.equal((await store.findByIdempotencyKey('k1'))?.state, 'PENDING');
  await store.setState('j1', 'SENT');
  assert.equal((await store.findByIdempotencyKey('k1'))?.state, 'SENT');
  assert.equal(await store.findByIdempotencyKey('nope'), null);
});

test('oauth pending: put -> resolve upsert -> get -> delete', async () => {
  const store = await freshStore();
  await store.putPending({ pendingId: 'p1', verifier: 'ver', emailHash: 'h', lane: 'BYO', clientId: 'c', sessionNonce: 'n', createdAt: 1, expiresAt: 2, resolved: null });
  assert.equal((await store.getPending('p1'))?.verifier, 'ver');
  assert.equal((await store.getPending('p1'))?.resolved, null);

  await store.putPending({ pendingId: 'p1', verifier: 'ver', emailHash: 'h', lane: 'BYO', clientId: 'c', sessionNonce: 'n', createdAt: 1, expiresAt: 2, resolved: { xUserId: 'x1', username: 'acme', accessToken: 'a', refreshToken: 'r' } });
  assert.equal((await store.getPending('p1'))?.resolved?.username, 'acme');

  await store.deletePending('p1');
  assert.equal(await store.getPending('p1'), null);
});

test('metering: per-day count with upsert increment', async () => {
  const store = await freshStore();
  assert.equal(await store.postsToday('h', 5), 0);
  await store.recordPost('h', 5);
  await store.recordPost('h', 5);
  assert.equal(await store.postsToday('h', 5), 2);
  assert.equal(await store.postsToday('h', 6), 0);
});

test('recent posts: record + filter by since', async () => {
  const store = await freshStore();
  await store.recordRecentPost('h', { text: 'old', postedAt: 100 });
  await store.recordRecentPost('h', { text: 'new', postedAt: 200 });
  assert.deepEqual((await store.recentPosts('h', 150)).map((p) => p.text), ['new']);
  assert.deepEqual((await store.recentPosts('h', 0)).map((p) => p.text), ['old', 'new']);
});

// Real Postgres validation — runs only when a DB URL is provided (docker compose up first).
//   CHOKEPOINT_TEST_DB_URL=postgres://chokepoint:pw@localhost:5442/chokepoint pnpm --filter @capx/chokepoint test
test('real Postgres round-trip (guarded by CHOKEPOINT_TEST_DB_URL)', { skip: !process.env.CHOKEPOINT_TEST_DB_URL }, async () => {
  const { createPgPool } = await import('../src/store/pg-pool.ts');
  const pool = createPgPool(process.env.CHOKEPOINT_TEST_DB_URL as string);
  await runMigrations(pool);
  const store = new PostgresStore(pool);
  const kms = new LocalKeyKms(LocalKeyKms.generateMasterKey());
  const access = await sealToken('atok', kms);
  const refresh = await sealToken('rtok', kms);
  await store.put({ vaultRef: 'it-v1', emailHash: 'it-h', xUserId: 'x1', username: 'acme', lane: 'BYO', standing: 'GOOD', access, refresh, refreshRotatedAt: 1, needsReauth: false });
  assert.equal((await store.getByRef('it-v1'))?.access.ciphertext, access.ciphertext);
  await store.addAllowlisted('it-h');
  assert.equal(await store.isAllowlisted('it-h'), true);
});
