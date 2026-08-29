import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANS,
  PACKS,
  MAX_THREAD_POSTS,
  evaluatePost,
  applyDraws,
  creditPack,
  cycleKey,
  emptyUsage,
  emptyPacks,
} from '../src/index.ts';
import type { PostKind, Usage } from '../src/index.ts';

const plain: PostKind = { hasLink: false, hasMedia: false, threadRole: 'none' };
const linky: PostKind = { ...plain, hasLink: true };

test('locked sheet numbers are exactly the 2026-08-29 locks', () => {
  assert.deepEqual(
    [PLANS.short.priceUsd, PLANS.short.posts, PLANS.short.urlPosts, PLANS.short.mediaPosts, PLANS.short.threads, PLANS.short.maxActiveLoops, PLANS.short.maxAccounts],
    [5, 70, 0, 10, 0, 0, 1],
  );
  assert.deepEqual(
    [PLANS.tall.priceUsd, PLANS.tall.posts, PLANS.tall.urlPosts, PLANS.tall.mediaPosts, PLANS.tall.threads, PLANS.tall.maxActiveLoops, PLANS.tall.maxAccounts],
    [15, 200, 25, 30, 10, 3, 2],
  );
  assert.equal(PLANS.grande.threads, Infinity);
  assert.deepEqual(
    [PLANS.grande.priceUsd, PLANS.grande.posts, PLANS.grande.urlPosts, PLANS.grande.mediaPosts, PLANS.grande.maxActiveLoops, PLANS.grande.maxAccounts],
    [35, 500, 50, 100, 21, 5],
  );
  assert.deepEqual(
    Object.entries(PACKS).map(([k, p]) => [k, p.size, p.priceUsd]),
    [['posts', 50, 2], ['url', 10, 3], ['media', 10, 1], ['threads', 10, 1]],
  );
});

test('short: link posts structurally banned — even with a URL pack balance', () => {
  const packs = { ...emptyPacks(), urlPosts: 10 };
  const v = evaluatePost('short', linky, emptyUsage(), packs);
  assert.equal(v.allowed, false);
  assert.match(v.reasons.join(' '), /link posts are not available/);
});

test('short: threads banned; url pack itself is not purchasable', () => {
  const v = evaluatePost('short', { ...plain, threadRole: 'start', threadDepth: 2 }, emptyUsage(), emptyPacks());
  assert.equal(v.allowed, false);
  assert.throws(() => creditPack(emptyPacks(), 'url', 1, 'short'), /not available on the short plan/);
  assert.throws(() => creditPack(emptyPacks(), 'threads', 1, 'short'), /not available/);
});

test('plain post draws the umbrella quota; media post draws both categories', () => {
  const v = evaluatePost('tall', { ...plain, hasMedia: true }, emptyUsage(), emptyPacks());
  assert.equal(v.allowed, true);
  assert.deepEqual(v.draws, [
    { category: 'posts', from: 'quota' },
    { category: 'mediaPosts', from: 'quota' },
  ]);
});

test('quota exhausted -> pack draw; both exhausted -> deny with upgrade hint', () => {
  const usage: Usage = { ...emptyUsage(), posts: PLANS.tall.posts };
  const denied = evaluatePost('tall', plain, usage, emptyPacks());
  assert.equal(denied.allowed, false);
  assert.match(denied.reasons[0], /monthly post quota reached \(200\/200\).*top-up pack/);

  const packs = creditPack(emptyPacks(), 'posts', 1, 'tall');
  const viaPack = evaluatePost('tall', plain, usage, packs);
  assert.equal(viaPack.allowed, true);
  assert.deepEqual(viaPack.draws, [{ category: 'posts', from: 'pack' }]);
});

test('applyDraws bumps usage for quota draws and burns pack balance for pack draws', () => {
  const packs = creditPack(emptyPacks(), 'media', 2, 'short'); // 20 media units
  const usage = { ...emptyUsage(), mediaPosts: PLANS.short.mediaPosts }; // media quota gone
  const v = evaluatePost('short', { ...plain, hasMedia: true }, usage, packs);
  assert.equal(v.allowed, true);
  const after = applyDraws(usage, packs, v.draws);
  assert.equal(after.usage.posts, 1); // umbrella from quota
  assert.equal(after.usage.mediaPosts, usage.mediaPosts); // not bumped — drawn from pack
  assert.equal(after.packs.mediaPosts, 19);
});

test('thread start consumes the threads quota; continuation does not', () => {
  const start = evaluatePost('tall', { ...plain, threadRole: 'start', threadDepth: 2 }, emptyUsage(), emptyPacks());
  assert.deepEqual(start.draws.map((d) => d.category), ['posts', 'threads']);
  const cont = evaluatePost('tall', { ...plain, threadRole: 'continuation', threadDepth: 5 }, emptyUsage(), emptyPacks());
  assert.deepEqual(cont.draws.map((d) => d.category), ['posts']);
});

test('universal thread ceiling: post #11 of a chain is refused on every plan', () => {
  for (const plan of ['tall', 'grande'] as const) {
    const v = evaluatePost(plan, { ...plain, threadRole: 'continuation', threadDepth: MAX_THREAD_POSTS + 1 }, emptyUsage(), emptyPacks());
    assert.equal(v.allowed, false, plan);
    assert.match(v.reasons.join(' '), /at most 10 posts/);
  }
});

test('thread posts may not carry links, any plan', () => {
  const v = evaluatePost('grande', { ...linky, threadRole: 'continuation', threadDepth: 3 }, emptyUsage(), emptyPacks());
  assert.equal(v.allowed, false);
  assert.match(v.reasons.join(' '), /thread posts may not contain links/);
});

test('grande threads are bounded only by the post quota', () => {
  const usage: Usage = { ...emptyUsage(), threads: 499 };
  const v = evaluatePost('grande', { ...plain, threadRole: 'start', threadDepth: 2 }, usage, emptyPacks());
  assert.equal(v.allowed, true);
});

test('tall URL quota: 25 then pack then deny', () => {
  const usage: Usage = { ...emptyUsage(), urlPosts: PLANS.tall.urlPosts };
  const denied = evaluatePost('tall', linky, usage, emptyPacks());
  assert.equal(denied.allowed, false);
  assert.match(denied.reasons[0], /link-post quota reached \(25\/25\)/);
  const ok = evaluatePost('tall', linky, usage, creditPack(emptyPacks(), 'url', 1, 'tall'));
  assert.equal(ok.allowed, true);
  assert.deepEqual(ok.draws, [
    { category: 'posts', from: 'quota' },
    { category: 'urlPosts', from: 'pack' },
  ]);
});

test('packs stack: quantity N credits N x size', () => {
  const p = creditPack(emptyPacks(), 'posts', 3, 'grande');
  assert.equal(p.posts, 150);
  assert.throws(() => creditPack(emptyPacks(), 'posts', 0, 'tall'), /positive integer/);
});

test('longform gated by plan flag', () => {
  assert.equal(evaluatePost('short', { ...plain, longform: true }, emptyUsage(), emptyPacks()).allowed, false);
  assert.equal(evaluatePost('tall', { ...plain, longform: true }, emptyUsage(), emptyPacks()).allowed, true);
});

test('cycleKey is the UTC calendar month', () => {
  assert.equal(cycleKey(Date.UTC(2026, 7, 29, 23, 59)), '2026-08');
  assert.equal(cycleKey(Date.UTC(2026, 8, 1, 0, 0)), '2026-09');
});
