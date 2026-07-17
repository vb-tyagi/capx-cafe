import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryStore } from '../src/store/memory.ts';
import { Outbox } from '../src/outbox/index.ts';
import { KeyedMutex } from '../src/outbox/mutex.ts';
import type { OutboxJob } from '@capx-cafe/core';

function job(o: Partial<OutboxJob> = {}): OutboxJob {
  return {
    id: 'j1',
    idempotencyKey: 'idem-1',
    emailHash: 'h_abc',
    vaultRef: 'v1',
    text: 'hello',
    aiGenerated: false,
    lane: 'BYO',
    state: 'PENDING',
    scheduledAtMs: 0,
    createdAtMs: 0,
    ...o,
  };
}

test('enqueue is idempotent on idempotencyKey (a retry does not double-insert)', async () => {
  const outbox = new Outbox(new InMemoryStore());
  const a = await outbox.enqueue(job());
  assert.equal(a.deduped, false);
  const b = await outbox.enqueue(job({ id: 'j2' })); // same idempotencyKey, different id
  assert.equal(b.deduped, true);
  assert.equal(b.job.id, 'j1', 'returns the ORIGINAL job, not the retry');
});

test('state transitions PENDING -> SENDING -> SENT', async () => {
  const store = new InMemoryStore();
  const outbox = new Outbox(store);
  await outbox.enqueue(job());
  await outbox.markSending('j1');
  assert.equal((await store.findByIdempotencyKey('idem-1'))?.state, 'SENDING');
  await outbox.markSent('j1');
  assert.equal((await store.findByIdempotencyKey('idem-1'))?.state, 'SENT');
});

test('KeyedMutex serializes same-key critical sections', async () => {
  const mutex = new KeyedMutex();
  const order: string[] = [];
  const section = (label: string, ms: number) => async () => {
    order.push(`start:${label}`);
    await new Promise((r) => setTimeout(r, ms));
    order.push(`end:${label}`);
  };
  // b is "faster" but must wait for a — same key serializes, no interleave.
  await Promise.all([mutex.run('h', section('a', 20)), mutex.run('h', section('b', 1))]);
  assert.deepEqual(order, ['start:a', 'end:a', 'start:b', 'end:b']);
});
