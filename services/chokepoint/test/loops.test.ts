import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { InMemoryStore } from '../src/store/memory.ts';
import { PostgresStore, runMigrations, type SqlPool } from '../src/store/postgres.ts';
import { Loops, isValidTimezone, type LoopStore } from '../src/loops/index.ts';

const NOW = 1_700_000_000_000;
const POSTS = ['first agent-written post', 'second agent-written post'];
const base = { emailHash: 'h_abc', timezone: 'Asia/Kolkata', timeOfDayMinutes: 540, daysOfWeek: [1, 3, 5], posts: POSTS };

async function pgStore(): Promise<PostgresStore> {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  const pool = new Pool() as unknown as SqlPool;
  await runMigrations(pool);
  return new PostgresStore(pool);
}

test('isValidTimezone accepts IANA zones, rejects junk and raw offsets', () => {
  assert.equal(isValidTimezone('Asia/Kolkata'), true);
  assert.equal(isValidTimezone('America/New_York'), true);
  assert.equal(isValidTimezone('UTC'), true);
  assert.equal(isValidTimezone('Mars/Olympus'), false);
  assert.equal(isValidTimezone('+05:30'), false); // offsets are exactly what we refuse — they break at DST
});

test('create validates its inputs and refuses a loop with no posts', async () => {
  const loops = new Loops(new InMemoryStore(), () => NOW);
  const bad = await loops.create({ ...base, posts: [] });
  assert.match(bad.problems.join(' '), /capx does not generate content/);

  assert.match((await loops.create({ ...base, timezone: 'Mars/Olympus' })).problems.join(' '), /unknown timezone/);
  assert.match((await loops.create({ ...base, timeOfDayMinutes: 1500 })).problems.join(' '), /0\.\.1439/);
  assert.match((await loops.create({ ...base, daysOfWeek: [] })).problems.join(' '), /daysOfWeek/);
  assert.match((await loops.create({ ...base, daysOfWeek: [9] })).problems.join(' '), /daysOfWeek/);
  assert.match((await loops.create({ ...base, posts: ['  '] })).problems.join(' '), /empty text/);
});

test('create -> list -> pause -> delete, all owner-scoped', async () => {
  const loops = new Loops(new InMemoryStore(), () => NOW);
  const { loop, problems } = await loops.create(base);
  assert.deepEqual(problems, []);
  assert.ok(loop);
  assert.deepEqual(loop.buffer, POSTS);
  assert.equal(loop.paused, false);

  assert.equal((await loops.list('h_abc')).length, 1);
  assert.equal((await loops.list('h_other')).length, 0, 'loops are scoped to their owner');

  // another user cannot touch it
  assert.equal(await loops.setPaused(loop.id, 'h_attacker', true), null);
  assert.equal(await loops.remove(loop.id, 'h_attacker'), false);
  assert.equal((await loops.get(loop.id))?.paused, false, 'attacker pause had no effect');

  assert.equal((await loops.setPaused(loop.id, 'h_abc', true))?.paused, true);
  assert.equal((await loops.listActive()).length, 0, 'paused loops are not active');
  assert.equal(await loops.remove(loop.id, 'h_abc'), true);
  assert.equal(await loops.get(loop.id), null);
});

test('topUp appends, and only auto-resumes a loop that PAUSED because it ran dry', async () => {
  const loops = new Loops(new InMemoryStore(), () => NOW);
  const { loop } = await loops.create({ ...base, posts: ['only one'] });
  assert.ok(loop);

  // simulate the tick draining it and pausing for 'buffer empty'
  const store = new InMemoryStore();
  const dry = new Loops(store, () => NOW);
  const made = (await dry.create({ ...base, posts: ['x'] })).loop!;
  await store.updateLoop({ ...made, buffer: [], paused: true, pausedReason: 'buffer empty' });
  const resumed = await dry.topUp(made.id, 'h_abc', ['fresh post']);
  assert.equal(resumed?.paused, false, 'a dry loop resumes when refilled');
  assert.deepEqual(resumed?.buffer, ['fresh post']);

  // a USER-paused loop must NOT be silently resumed by a top-up
  await loops.setPaused(loop.id, 'h_abc', true);
  const still = await loops.topUp(loop.id, 'h_abc', ['more']);
  assert.equal(still?.paused, true, 'a user pause survives a top-up');
  assert.deepEqual(still?.buffer, ['only one', 'more']);
});

test('PostgresStore implements LoopStore against real SQL (arrays round-trip)', async () => {
  const store = await pgStore();
  const loops = new Loops(store as unknown as LoopStore, () => NOW);
  const { loop } = await loops.create(base);
  assert.ok(loop);

  const got = await loops.get(loop.id);
  assert.deepEqual(got?.daysOfWeek, [1, 3, 5], 'integer[] round-trips');
  assert.deepEqual(got?.buffer, POSTS, 'text[] round-trips');
  assert.equal(got?.timezone, 'Asia/Kolkata');

  await store.updateLoop({ ...loop, buffer: ['only left'], lastFiredDayKey: '2026-07-17', paused: true, pausedReason: 'buffer empty' });
  const after = await loops.get(loop.id);
  assert.deepEqual(after?.buffer, ['only left']);
  assert.equal(after?.lastFiredDayKey, '2026-07-17');
  assert.equal(after?.pausedReason, 'buffer empty');
  assert.equal((await store.listActiveLoops()).length, 0);

  await store.deleteLoop(loop.id);
  assert.equal(await loops.get(loop.id), null);
});
