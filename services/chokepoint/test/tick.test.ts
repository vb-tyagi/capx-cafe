import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryStore } from '../src/store/memory.ts';
import { LocalKeyKms } from '../src/vault/kms.ts';
import { Vault } from '../src/vault/index.ts';
import { HmacSessionSigner } from '../src/admission/session.ts';
import { Admission } from '../src/admission/index.ts';
import { RecentPosts } from '../src/recent/index.ts';
import { Outbox } from '../src/outbox/index.ts';
import { Loops } from '../src/loops/index.ts';
import { LoopTicker } from '../src/loops/tick.ts';
import { jitterMinutes } from '../src/loops/schedule.ts';
import { PublishGate } from '../src/gate/index.ts';
import { XAdapter } from '../src/xclient/index.ts';

const CLEAN = 'Shipping the anti-slop engine today: deterministic scoring, real unit tests, and a concrete walkthrough of the pipeline.';
const CLEAN2 = 'A separate concrete update: wired the loop ticker, timezone maths, and the durable outbox, each with tests.';
// 09:00 Kolkata on Fri 2026-07-17 == 03:30Z; add the day's jitter to land exactly on target.
const DAY = '2026-07-17';
// NB: jitter is keyed per (loop, local day), so each day's target differs by a few minutes — you cannot
// just add 7*24h to last week's fire instant and land on target again.
const at9amOn = (loopId: string, dayKey: string, isoZ: string): number => Date.parse(isoZ) + jitterMinutes(loopId, dayKey) * 60_000;
const at9am = (loopId: string): number => at9amOn(loopId, DAY, '2026-07-17T03:30:00Z');

async function setup(opts: { verified?: boolean; ageDays?: number; failSend?: boolean } = {}) {
  const store = new InMemoryStore();
  const kms = new LocalKeyKms(LocalKeyKms.generateMasterKey());
  const NOW0 = Date.parse('2026-07-17T03:30:00Z');
  const vault = new Vault(store, kms, () => NOW0);
  await store.addAllowlisted('h_abc');
  const ageDays = opts.ageDays ?? 400;
  await vault.put(
    {
      emailHash: 'h_abc',
      xUserId: 'x1',
      username: 'acme',
      lane: 'BYO',
      standing: 'GOOD',
      verified: opts.verified ?? true,
      createdAtMs: NOW0 - ageDays * 86_400_000,
    },
    { access: 'atok', refresh: 'rtok' },
  );
  const admission = new Admission(store, new HmacSessionSigner('sign', 15 * 60_000, 12 * 60 * 60_000));
  const posted: string[] = [];
  let clock = NOW0;
  const gate = new PublishGate({
    admission,
    vault,
    client: new XAdapter({
      vault,
      post: async ({ text }) => {
        if (opts.failSend) throw new Error('X 5xx');
        posted.push(text);
        return { id: `tw-${posted.length}` };
      },
    }),
    now: () => clock,
    recentPosts: new RecentPosts(store),
    outbox: new Outbox(store),
  });
  const loops = new Loops(store, () => NOW0);
  const ticker = new LoopTicker({ loops, gate, now: () => clock });
  return { store, loops, ticker, posted, admission, setClock: (t: number) => { clock = t; } };
}

const mkLoop = async (loops: Loops, posts: string[]) =>
  (await loops.create({ emailHash: 'h_abc', timezone: 'Asia/Kolkata', timeOfDayMinutes: 9 * 60, daysOfWeek: [5], posts })).loop!;

test('fires at 9am local, pops ONE post, and stamps the day', async () => {
  const s = await setup();
  const loop = await mkLoop(s.loops, [CLEAN, CLEAN2]);
  s.setClock(at9am(loop.id));

  const out = await s.ticker.tick();
  assert.equal(out[0]?.fired, true, JSON.stringify(out));
  assert.deepEqual(s.posted, [CLEAN]);
  const after = await s.loops.get(loop.id);
  assert.deepEqual(after?.buffer, [CLEAN2], 'exactly one post consumed');
  assert.equal(after?.lastFiredDayKey, DAY);
});

test('EXACTLY-ONCE: overlapping ticks in the same local day post only once', async () => {
  const s = await setup();
  const loop = await mkLoop(s.loops, [CLEAN, CLEAN2]);
  s.setClock(at9am(loop.id));

  await s.ticker.tick();
  await s.ticker.tick(); // Cloud Scheduler retry / a second Cloud Run instance
  await s.ticker.tick();
  assert.equal(s.posted.length, 1, 'three ticks, one post');
  assert.deepEqual((await s.loops.get(loop.id))?.buffer, [CLEAN2]);
});

test('buffer runs dry -> loop PAUSES and says so (capx never writes a filler post)', async () => {
  const s = await setup();
  const loop = await mkLoop(s.loops, [CLEAN]);
  s.setClock(at9am(loop.id));
  await s.ticker.tick(); // consumes the only post
  assert.equal(s.posted.length, 1);

  // next Friday (its own jitter): nothing left to say
  s.setClock(at9amOn(loop.id, '2026-07-24', '2026-07-24T03:30:00Z'));
  const out = await s.ticker.tick();
  assert.match(out[0]?.reason ?? '', /buffer empty/);
  const after = await s.loops.get(loop.id);
  assert.equal(after?.paused, true);
  assert.equal(after?.pausedReason, 'buffer empty');
  assert.equal(s.posted.length, 1, 'no invented content');

  // topping up resumes it
  await s.loops.topUp(loop.id, 'h_abc', [CLEAN2]);
  assert.equal((await s.loops.get(loop.id))?.paused, false);
});

test('a transient X failure gives the post back (not silently lost)', async () => {
  const s = await setup({ failSend: true });
  const loop = await mkLoop(s.loops, [CLEAN, CLEAN2]);
  s.setClock(at9am(loop.id));

  const out = await s.ticker.tick();
  assert.equal(out[0]?.outcome, 'publish_failed');
  const after = await s.loops.get(loop.id);
  assert.deepEqual(after?.buffer, [CLEAN, CLEAN2], 'the post was returned to the front of the queue');
  assert.equal(after?.lastFiredDayKey, DAY, 'but the day stays burned — retry tomorrow, do not hammer X');
});

test('poller outage: a post 3h late is SKIPPED and the day burned, not posted stale', async () => {
  const s = await setup();
  const loop = await mkLoop(s.loops, [CLEAN]);
  s.setClock(at9am(loop.id) + 3 * 60 * 60_000); // poller was down until noon

  const out = await s.ticker.tick();
  assert.equal(out[0]?.fired, false);
  assert.match(out[0]?.reason ?? '', /too late/);
  assert.equal(s.posted.length, 0);
  const after = await s.loops.get(loop.id);
  assert.deepEqual(after?.buffer, [CLEAN], 'the post is kept for a future day');
  assert.equal(after?.lastFiredDayKey, DAY, 'day burned so a later tick today cannot fire it');
});

test('SECURITY: a loop CANNOT bypass casserole — spam in the buffer is blocked, never sent', async () => {
  const s = await setup();
  const spam = 'RT if you agree!!!! 🚀🚀🚀🚀🚀 #a #b #c #d #e #f #g #h #i';
  const loop = await mkLoop(s.loops, [spam]);
  s.setClock(at9am(loop.id));

  const out = await s.ticker.tick();
  assert.equal(out[0]?.outcome, 'blocked');
  assert.equal(s.posted.length, 0, 'the guardrail applies to scheduled posts exactly as to manual ones');
});

test('SECURITY: the kill-switch stops loops too', async () => {
  const s = await setup();
  const loop = await mkLoop(s.loops, [CLEAN]);
  await s.admission.revoke({ global: true });
  s.setClock(at9am(loop.id));

  const out = await s.ticker.tick();
  assert.equal(out[0]?.fired, false);
  assert.equal(s.posted.length, 0);
});

test('ELIGIBILITY: an unverified / too-new account cannot run loops (L1)', async () => {
  const unver = await setup({ verified: false });
  const l1 = await mkLoop(unver.loops, [CLEAN]);
  unver.setClock(at9am(l1.id));
  const a = await unver.ticker.tick();
  assert.equal(a[0]?.outcome, 'blocked');
  assert.match(a[0]?.reason ?? '', /blue tick/);
  assert.equal(unver.posted.length, 0);

  const fresh = await setup({ ageDays: 3 });
  const l2 = await mkLoop(fresh.loops, [CLEAN]);
  fresh.setClock(at9am(l2.id));
  const b = await fresh.ticker.tick();
  assert.equal(b[0]?.outcome, 'blocked');
  assert.match(b[0]?.reason ?? '', /too new/);
  assert.equal(fresh.posted.length, 0);
});
