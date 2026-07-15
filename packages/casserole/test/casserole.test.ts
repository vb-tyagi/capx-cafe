import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGauntlet, computeSlopScore, similarity } from '../src/index.ts';
import type { GauntletContext } from '../src/index.ts';
import { Tier, Platform, TweetType, Autonomy, AccountStanding, Verdict } from '@capx/core';
import type { Handle, DraftPost, LoopConfig } from '@capx/core';

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;

function makeHandle(o: Partial<Handle> = {}): Handle {
  return {
    id: 'h1',
    workspaceId: 'w1',
    platform: Platform.X,
    username: 'acme',
    verified: true,
    ageDays: 120,
    standing: AccountStanding.GOOD,
    connectedAt: NOW - 200 * 24 * HOUR,
    ...o,
  };
}
function makeLoop(o: Partial<LoopConfig> = {}): LoopConfig {
  return {
    id: 'loop1',
    handleId: 'h1',
    timeOfDayMinutes: 540,
    daysOfWeek: [1, 3, 5],
    type: TweetType.TEXT,
    model: 'claude',
    category: 'shipping updates',
    tags: ['build'],
    brief: 'share a concrete build update',
    styleSources: ['@dhh'],
    autonomy: Autonomy.AUTONOMOUS,
    trainingWheelsRemaining: 0,
    ...o,
  };
}
function makeCtx(o: Partial<GauntletContext> = {}): GauntletContext {
  return { tier: Tier.TEAM, handle: makeHandle(), loop: makeLoop(), history: [], now: NOW, accountDailyCeiling: 10, killSwitch: { global: false, handle: false }, ...o };
}
function makePost(o: Partial<DraftPost> = {}): DraftPost {
  return {
    text: 'Shipping the anti-slop engine today: deterministic scoring, real unit tests, and zero external keys. Here is a concrete walkthrough of the pipeline.',
    type: TweetType.TEXT,
    hasLink: false,
    aiGenerated: true,
    hashtags: [],
    loopId: 'loop1',
    styleSources: ['@dhh'],
    ...o,
  };
}

test('clean autonomous post passes and schedules without human review', () => {
  const res = runGauntlet(makePost(), makeCtx());
  assert.equal(res.verdict, Verdict.PASS);
  assert.equal(res.requiresHumanReview, false);
  assert.equal(typeof res.scheduledAtMs, 'number');
});

test('scheduled time is jittered — never exactly on the minute', () => {
  const res = runGauntlet(makePost(), makeCtx());
  assert.notEqual((res.scheduledAtMs as number) % 60_000, 0);
});

test('unverified handle cannot run Loops (L1 block)', () => {
  const res = runGauntlet(makePost(), makeCtx({ handle: makeHandle({ verified: false }) }));
  assert.equal(res.verdict, Verdict.BLOCK);
  assert.ok(res.finalReasons.some((r) => r.includes('blue tick')));
});

test('SOLO tier cannot run Loops', () => {
  const res = runGauntlet(makePost(), makeCtx({ tier: Tier.SOLO }));
  assert.equal(res.verdict, Verdict.BLOCK);
  assert.ok(res.finalReasons.some((r) => r.includes('TEAM+')));
});

test('account younger than 30 days cannot run Loops', () => {
  const res = runGauntlet(makePost(), makeCtx({ handle: makeHandle({ ageDays: 10 }) }));
  assert.equal(res.verdict, Verdict.BLOCK);
  assert.ok(res.finalReasons.some((r) => r.includes('too new')));
});

test('account daily ceiling closes the multi-loop loophole', () => {
  const history = Array.from({ length: 10 }, (_, i) => ({
    text: `unrelated post number ${i}`,
    postedAt: NOW - (2 * HOUR + i * 1000),
    loopId: 'other',
  }));
  const res = runGauntlet(makePost(), makeCtx({ history, accountDailyCeiling: 10 }));
  assert.equal(res.verdict, Verdict.BLOCK);
  assert.ok(res.finalReasons.some((r) => r.includes('daily ceiling')));
});

test('a loop cannot post twice in a day', () => {
  const history = [{ text: 'a different earlier update', postedAt: NOW - 3 * HOUR, loopId: 'loop1' }];
  const res = runGauntlet(makePost(), makeCtx({ history }));
  assert.equal(res.verdict, Verdict.BLOCK);
  assert.ok(res.finalReasons.some((r) => r.includes('max 1/day')));
});

test('near-duplicate content is blocked', () => {
  const dup = 'Deterministic scoring plus real tests — this is our anti-slop engine walkthrough for today.';
  const res = runGauntlet(
    makePost({ text: dup }),
    makeCtx({ history: [{ text: dup, postedAt: NOW - 3 * HOUR, loopId: 'other' }] }),
  );
  assert.equal(res.verdict, Verdict.BLOCK);
  assert.ok(res.finalReasons.some((r) => r.toLowerCase().includes('duplicate')));
});

test('engagement-bait slop is blocked', () => {
  const spam = 'RT if you agree!!!! 🚀🚀🚀🚀🚀🚀🚀 #crypto #web3 #airdrop #free #giveaway #now';
  const res = runGauntlet(makePost({ text: spam }), makeCtx());
  assert.equal(res.verdict, Verdict.BLOCK);
  assert.ok(res.finalReasons.some((r) => r.includes('slop')));
});

test('AI graphic requires human review even in autonomous mode', () => {
  const res = runGauntlet(makePost({ type: TweetType.GRAPHIC, aiGenerated: true }), makeCtx());
  assert.equal(res.verdict, Verdict.HOLD);
  assert.equal(res.requiresHumanReview, true);
});

test('training wheels force review on the first posts of a new loop', () => {
  const res = runGauntlet(makePost(), makeCtx({ loop: makeLoop({ trainingWheelsRemaining: 3 }) }));
  assert.equal(res.verdict, Verdict.PASS);
  assert.equal(res.requiresHumanReview, true);
});

test('user-reviewed mode always requires review', () => {
  const res = runGauntlet(makePost(), makeCtx({ loop: makeLoop({ autonomy: Autonomy.USER_REVIEWED }) }));
  assert.equal(res.requiresHumanReview, true);
});

test('bad account health auto-pauses (block)', () => {
  const res = runGauntlet(
    makePost(),
    makeCtx({ health: { followerDelta24h: -200, replyRatioAnomaly: false, platformFlags: 1 } }),
  );
  assert.equal(res.verdict, Verdict.BLOCK);
  assert.ok(res.finalReasons.some((r) => r.includes('auto-pause')));
});

test('global kill switch blocks everything', () => {
  const res = runGauntlet(makePost(), makeCtx({ killSwitch: { global: true, handle: false } }));
  assert.equal(res.verdict, Verdict.BLOCK);
});

test('more than 3 style profiles is blocked (cloning risk)', () => {
  const res = runGauntlet(makePost({ styleSources: ['@a', '@b', '@c', '@d'] }), makeCtx());
  assert.equal(res.verdict, Verdict.BLOCK);
});

test('variation engine flags a loop repeating itself', () => {
  const line = 'Here is my daily concrete build update on the shipping pipeline and tests.';
  const res = runGauntlet(makePost({ text: line }), makeCtx({ loopRecentOutputs: [line] }));
  assert.ok(res.verdict === Verdict.REGENERATE || res.verdict === Verdict.BLOCK);
});

test('audit record is always produced with an AI-label decision', () => {
  const res = runGauntlet(makePost(), makeCtx());
  assert.equal((res.audit as { aiLabelRequired?: boolean }).aiLabelRequired, true);
});

test('computeSlopScore: clean low, bait high', () => {
  assert.ok(computeSlopScore(makePost()).score < 0.5);
  assert.ok(computeSlopScore(makePost({ text: 'RT if you agree, tag a friend, comment below!!!!' })).score >= 0.5);
});

test('similarity: identical ~1, different low', () => {
  assert.ok(similarity('hello world foo bar', 'hello world foo bar') > 0.99);
  assert.ok(similarity('completely different text here', 'nothing alike over yonder') < 0.5);
});
