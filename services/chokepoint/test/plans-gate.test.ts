import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryStore } from '../src/store/memory.ts';
import { LocalKeyKms } from '../src/vault/kms.ts';
import { Vault } from '../src/vault/index.ts';
import { HmacSessionSigner } from '../src/admission/session.ts';
import { Admission } from '../src/admission/index.ts';
import { PlanMetering } from '../src/metering/plans.ts';
import { PublishGate } from '../src/gate/index.ts';
import { Loops } from '../src/loops/index.ts';
import { FakePlatformClient } from '@capx-cafe/platform-client';
import type { PlatformClient } from '@capx-cafe/platform-client';
import { cycleKey } from '@capx-cafe/counter';
import type { Lane } from '@capx-cafe/core';
import type { PlanId } from '@capx-cafe/counter';

const NOW = 1_700_000_000_000;
const CYCLE = cycleKey(NOW);
const X_USER = 'x1';
const CLEAN =
  'Shipping the anti-slop engine today: deterministic scoring, real unit tests, and zero external keys. Here is a concrete walkthrough of the pipeline.';
/** distinct clean texts so nothing upstream trips on duplicates. */
const clean = (n: number): string => `${CLEAN} Part ${n} of the series.`;

async function rig(opts: { lane?: Lane; plan: PlanId; client?: PlatformClient }) {
  const store = new InMemoryStore();
  const kms = new LocalKeyKms(LocalKeyKms.generateMasterKey());
  const vault = new Vault(store, kms, () => NOW);
  await store.addAllowlisted('h_abc');
  await vault.put(
    { emailHash: 'h_abc', xUserId: X_USER, username: 'acme', lane: opts.lane ?? 'CAPX_APP', standing: 'GOOD', verified: true, createdAtMs: 1_600_000_000_000 },
    { access: 'a', refresh: 'r' },
  );
  const admission = new Admission(store, new HmacSessionSigner('sign', 15 * 60_000, 12 * 60 * 60_000));
  const client = opts.client ?? new FakePlatformClient();
  const planMetering = new PlanMetering(store, opts.plan);
  const gate = new PublishGate({ admission, vault, client, now: () => NOW, planMetering });
  return { store, gate, planMetering, client, bearer: admission.issueSession('h_abc', NOW) };
}

test('short plan: a link post is structurally rejected before any send', async () => {
  const { gate, bearer, client } = await rig({ plan: 'short' });
  const r = await gate.postNow({ bearer, text: `${CLEAN} Details: https://capx.cafe/docs`, aiGenerated: true, idempotencyKey: 'k1' });
  assert.equal(r.outcome, 'rejected');
  assert.match(r.finalReasons.join(' '), /link posts are not available on the short plan/);
  assert.equal((client as FakePlatformClient).calls.length, 0); // never reached X
});

test('monthly quota exhausts -> deny with pack hint; a posts pack unblocks; usage/pack draws recorded', async () => {
  const { gate, bearer, store, planMetering } = await rig({ plan: 'short' });
  for (let i = 0; i < 70; i += 1) await store.bumpPlanUsage('h_abc', CYCLE, 'posts');
  const denied = await gate.postNow({ bearer, text: clean(1), aiGenerated: true, idempotencyKey: 'k1' });
  assert.equal(denied.outcome, 'rejected');
  assert.match(denied.finalReasons.join(' '), /monthly post quota reached \(70\/70\).*top-up pack/);

  await planMetering.creditPack('h_abc', 'posts', 1, NOW); // +50
  const ok = await gate.postNow({ bearer, text: clean(2), aiGenerated: true, idempotencyKey: 'k2' });
  assert.equal(ok.outcome, 'published');
  assert.equal((await store.getPackBalances('h_abc', CYCLE))?.posts, 49); // pack burned, not quota
  assert.equal((await store.getPlanUsage('h_abc', CYCLE))?.posts, 70); // quota untouched
});

test('media posts draw the media category alongside the umbrella', async () => {
  const { gate, bearer, store } = await rig({ plan: 'tall' });
  const r = await gate.postNow({ bearer, text: clean(1), aiGenerated: true, idempotencyKey: 'k1', mediaIds: ['m1'] });
  assert.equal(r.outcome, 'published');
  const usage = await store.getPlanUsage('h_abc', CYCLE);
  assert.deepEqual({ posts: usage?.posts, media: usage?.mediaPosts }, { posts: 1, media: 1 });
});

test('threads: first reply starts the chain (thread quota), deeper replies continue, #11 is refused', async () => {
  const { gate, bearer, store } = await rig({ plan: 'tall' });
  const root = await gate.postNow({ bearer, text: clean(0), aiGenerated: true, idempotencyKey: 'root' });
  assert.equal(root.outcome, 'published');
  let parentId = root.platformPostId!;
  for (let depth = 2; depth <= 10; depth += 1) {
    const r = await gate.postNow({ bearer, text: clean(depth), aiGenerated: true, idempotencyKey: `d${depth}`, inReplyToId: parentId });
    assert.equal(r.outcome, 'published', `depth ${depth}`);
    parentId = r.platformPostId!;
  }
  const eleventh = await gate.postNow({ bearer, text: clean(11), aiGenerated: true, idempotencyKey: 'd11', inReplyToId: parentId });
  assert.equal(eleventh.outcome, 'rejected');
  assert.match(eleventh.finalReasons.join(' '), /at most 10 posts/);
  const usage = await store.getPlanUsage('h_abc', CYCLE);
  assert.equal(usage?.threads, 1); // one chain started, however deep it went
  assert.equal(usage?.posts, 10); // root + 9 replies sent
});

test('thread posts may not carry links (any plan)', async () => {
  const { gate, bearer } = await rig({ plan: 'grande' });
  const root = await gate.postNow({ bearer, text: clean(0), aiGenerated: true, idempotencyKey: 'root' });
  const r = await gate.postNow({ bearer, text: `${CLEAN} See https://capx.cafe`, aiGenerated: true, idempotencyKey: 'r1', inReplyToId: root.platformPostId });
  assert.equal(r.outcome, 'rejected');
  assert.match(r.finalReasons.join(' '), /thread posts may not contain links/);
});

test('reply policy: a foreign-authored parent is rejected; an own external post is allowed and starts a chain', async () => {
  const fake = new FakePlatformClient();
  fake.postAuthors.set('ext-own', X_USER);
  fake.postAuthors.set('ext-other', 'someone-else');
  const { gate, bearer, store } = await rig({ plan: 'tall', client: fake });

  const foreign = await gate.postNow({ bearer, text: clean(1), aiGenerated: true, idempotencyKey: 'k1', inReplyToId: 'ext-other' });
  assert.equal(foreign.outcome, 'rejected');
  assert.match(foreign.finalReasons.join(' '), /only chain onto your own posts/);

  const gone = await gate.postNow({ bearer, text: clean(2), aiGenerated: true, idempotencyKey: 'k2', inReplyToId: 'ext-gone' });
  assert.equal(gone.outcome, 'rejected');
  assert.match(gone.finalReasons.join(' '), /not found on X/);

  const own = await gate.postNow({ bearer, text: clean(3), aiGenerated: true, idempotencyKey: 'k3', inReplyToId: 'ext-own' });
  assert.equal(own.outcome, 'published');
  assert.equal((await store.getPlanUsage('h_abc', CYCLE))?.threads, 1); // counted as a thread start
});

test('reply verification fails CLOSED when the client cannot look up authors', async () => {
  const noLookup: PlatformClient = { publish: async (req) => ({ platformPostId: 'p1', scheduledAtMs: req.scheduledAtMs }) };
  const { gate, bearer } = await rig({ plan: 'tall', client: noLookup });
  const r = await gate.postNow({ bearer, text: clean(1), aiGenerated: true, idempotencyKey: 'k1', inReplyToId: 'unknown' });
  assert.equal(r.outcome, 'rejected');
  assert.match(r.finalReasons.join(' '), /reply verification unavailable/);
});

test('BYO lane: no plan quotas, but the replies-onto-own-posts policy still applies', async () => {
  const fake = new FakePlatformClient();
  fake.postAuthors.set('ext-other', 'someone-else');
  const { gate, bearer, store } = await rig({ lane: 'BYO', plan: 'short', client: fake });
  // link post on BYO sails through (quotas are capx-app-lane only)
  const linky = await gate.postNow({ bearer, text: `${CLEAN} https://capx.cafe`, aiGenerated: true, idempotencyKey: 'k1' });
  assert.equal(linky.outcome, 'published');
  assert.equal(await store.getPlanUsage('h_abc', CYCLE), null); // nothing metered
  // but replying to someone else's post is still structurally refused
  const foreign = await gate.postNow({ bearer, text: clean(2), aiGenerated: true, idempotencyKey: 'k2', inReplyToId: 'ext-other' });
  assert.equal(foreign.outcome, 'rejected');
  assert.match(foreign.finalReasons.join(' '), /only chain onto your own posts/);
});

test('per-user plan assignment overrides the default', async () => {
  const { gate, bearer, store } = await rig({ plan: 'tall' });
  await store.setUserPlan('h_abc', 'short');
  const r = await gate.postNow({ bearer, text: `${CLEAN} https://capx.cafe`, aiGenerated: true, idempotencyKey: 'k1' });
  assert.equal(r.outcome, 'rejected');
  assert.match(r.finalReasons.join(' '), /link posts are not available on the short plan/);
});

test('loop caps: short gets none, tall gets 3 active, pausing frees a slot', async () => {
  const store = new InMemoryStore();
  const plans = new PlanMetering(store, 'tall');
  let plan: PlanId = 'short';
  await store.setUserPlan('h1', plan);
  const loops = new Loops(store, () => NOW, { activeCap: (eh) => plans.maxActiveLoops(eh) });
  const input = { emailHash: 'h1', timezone: 'Asia/Kolkata', timeOfDayMinutes: 600, daysOfWeek: [1, 3], posts: ['post one'] };

  const short = await loops.create(input);
  assert.match(short.problems.join(' '), /not available on your plan/);

  plan = 'tall';
  await store.setUserPlan('h1', plan);
  for (let i = 0; i < 3; i += 1) assert.equal((await loops.create(input)).problems.length, 0, `loop ${i}`);
  const fourth = await loops.create(input);
  assert.match(fourth.problems.join(' '), /active-loop limit reached \(3\/3\)/);

  const existing = await loops.list('h1');
  await loops.setPaused(existing[0].id, 'h1', true);
  assert.equal((await loops.create(input)).problems.length, 0); // slot freed
});
