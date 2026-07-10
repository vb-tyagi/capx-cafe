import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  preflightCost,
  preflightComposite,
  CreditLedger,
  InsufficientCreditsError,
  MICRO_USD_PER_CREDIT,
} from '../src/index.ts';
import { TIER_LIMITS } from '../../core/src/index.ts';

const T0 = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;

test('plain post is far cheaper than a link post', () => {
  const text = preflightCost('POST_TEXT', 'SOLO');
  const link = preflightCost('POST_LINK', 'SOLO');
  assert.equal(text.credits, 24); // 15000 * 1.6 / 1000
  assert.equal(link.credits, 320); // 200000 * 1.6 / 1000
  assert.ok(link.credits > text.credits * 10, 'links must dominate cost');
});

test('higher tiers get a better credit rate (lower markup)', () => {
  const solo = preflightCost('POST_TEXT', 'SOLO'); // 60% markup
  const org = preflightCost('POST_TEXT', 'ORG'); // 30% markup
  assert.ok(org.credits < solo.credits, 'ORG should cost fewer credits than SOLO');
  assert.equal(org.credits, 20); // 15000 * 1.3 / 1000
});

test('reads are cheap; AI image generation carries real cost', () => {
  assert.equal(preflightCost('READ', 'SOLO').credits, 8);
  assert.equal(preflightCost('AI_IMAGE_GEN', 'SOLO').credits, 80);
});

test('composite (graphic tweet = generate image + post graphic)', () => {
  const c = preflightComposite(['AI_IMAGE_GEN', 'POST_GRAPHIC'], 'TEAM');
  const sum = preflightCost('AI_IMAGE_GEN', 'TEAM').credits + preflightCost('POST_GRAPHIC', 'TEAM').credits;
  assert.equal(c.credits, sum);
  assert.equal(c.parts.length, 2);
});

test('credit unit is $0.001', () => {
  assert.equal(MICRO_USD_PER_CREDIT, 1000);
});

test('ledger charges deduct balance and record entries', () => {
  const l = new CreditLedger('TEAM', 1000);
  const e = l.charge('POST_TEXT', T0);
  assert.equal(e.kind, 'charge');
  assert.ok(e.credits < 0);
  assert.equal(l.getBalance(), 1000 - preflightCost('POST_TEXT', 'TEAM').credits);
  assert.equal(l.getEntries().length, 1);
});

test('insufficient credits throws', () => {
  const l = new CreditLedger('SOLO', 10);
  assert.throws(() => l.charge('POST_LINK', T0), InsufficientCreditsError);
  assert.equal(l.getBalance(), 10, 'balance unchanged after failed charge');
});

test('dedup-aware reads: same resource within 24h is free', () => {
  const l = new CreditLedger('TEAM', 1000);
  const first = l.chargeRead('tweet:123', T0);
  assert.ok(first, 'first read charges');
  const second = l.chargeRead('tweet:123', T0 + HOUR);
  assert.equal(second, null, 'same resource within 24h is free');
  const later = l.chargeRead('tweet:123', T0 + 25 * HOUR);
  assert.ok(later, 'after 24h it charges again');
});

test('grants and top-ups increase balance', () => {
  const l = new CreditLedger('SOLO', 0);
  l.grant(TIER_LIMITS.SOLO.freeStarterCredits, T0, 'starter');
  assert.equal(l.getBalance(), 2000);
  l.topUp(500, T0);
  assert.equal(l.getBalance(), 2500);
});

test('free starter credits are meaningful (SOLO buys many plain posts)', () => {
  const posts = Math.floor(TIER_LIMITS.SOLO.freeStarterCredits / preflightCost('POST_TEXT', 'SOLO').credits);
  assert.ok(posts >= 50, `starter credits should cover >=50 plain posts, got ${posts}`);
});
