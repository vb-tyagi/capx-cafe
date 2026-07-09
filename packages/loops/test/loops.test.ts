import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runLoopTick, actionsForDraft } from '../src/index.ts';
import { FakePlatformClient } from '../../platform-client/src/index.ts';
import { CreditLedger, preflightCost } from '../../credits/src/index.ts';
import type { GauntletContext } from '../../guardrails/src/index.ts';
import { Tier, Platform, TweetType, Autonomy, AccountStanding } from '../../core/src/index.ts';
import type { Handle, DraftPost, LoopConfig } from '../../core/src/index.ts';

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
  return { tier: Tier.TEAM, handle: makeHandle(), loop: makeLoop(), history: [], now: NOW, accountDailyCeiling: 10, ...o };
}
function makePost(o: Partial<DraftPost> = {}): DraftPost {
  return {
    text: 'Shipping the Loops orchestrator today: gauntlet, credit pre-flight, and a fake platform adapter, all wired end to end with real tests.',
    type: TweetType.TEXT,
    hasLink: false,
    aiGenerated: true,
    hashtags: [],
    loopId: 'loop1',
    styleSources: ['@dhh'],
    ...o,
  };
}

test('clean autonomous post publishes through the adapter and charges credits', async () => {
  const ledger = new CreditLedger('TEAM', 1000);
  const client = new FakePlatformClient();
  const res = await runLoopTick(makePost(), makeCtx(), ledger, client);

  const expected = preflightCost('AI_TEXT_GEN', 'TEAM').credits + preflightCost('POST_TEXT', 'TEAM').credits;
  assert.equal(res.outcome, 'published');
  assert.equal(client.calls.length, 1, 'exactly one publish reached the platform');
  assert.equal(res.creditsCharged, expected);
  assert.equal(ledger.getBalance(), 1000 - expected);
  assert.ok(res.publish?.platformPostId.startsWith('fake-post-'));
});

test('CHOKEPOINT: a blocked (spammy) post never reaches the platform and is never charged', async () => {
  const ledger = new CreditLedger('TEAM', 1000);
  const client = new FakePlatformClient();
  const spam = 'RT if you agree!!!! 🚀🚀🚀🚀🚀🚀🚀 #a #b #c #d #e #f';
  const res = await runLoopTick(makePost({ text: spam }), makeCtx(), ledger, client);

  assert.equal(res.outcome, 'blocked');
  assert.equal(client.calls.length, 0, 'no publish reached the platform');
  assert.equal(res.creditsCharged, 0);
  assert.equal(ledger.getBalance(), 1000, 'balance untouched');
});

test('AI graphic is held for review — not auto-published', async () => {
  const ledger = new CreditLedger('TEAM', 1000);
  const client = new FakePlatformClient();
  const res = await runLoopTick(makePost({ type: TweetType.GRAPHIC, aiGenerated: true }), makeCtx(), ledger, client);
  assert.equal(res.outcome, 'held_for_review');
  assert.equal(client.calls.length, 0);
  assert.equal(ledger.getBalance(), 1000);
});

test('user-reviewed loop holds even a clean post', async () => {
  const ledger = new CreditLedger('TEAM', 1000);
  const client = new FakePlatformClient();
  const res = await runLoopTick(makePost(), makeCtx({ loop: makeLoop({ autonomy: Autonomy.USER_REVIEWED }) }), ledger, client);
  assert.equal(res.outcome, 'held_for_review');
  assert.equal(client.calls.length, 0);
});

test('insufficient credits stops publishing (no partial charge, no publish)', async () => {
  const ledger = new CreditLedger('TEAM', 10);
  const client = new FakePlatformClient();
  const res = await runLoopTick(makePost(), makeCtx(), ledger, client);
  assert.equal(res.outcome, 'insufficient_credits');
  assert.equal(client.calls.length, 0);
  assert.equal(ledger.getBalance(), 10, 'no credits deducted');
});

test('actionsForDraft maps draft shape to billable actions', () => {
  assert.deepEqual(actionsForDraft(makePost()), ['AI_TEXT_GEN', 'POST_TEXT']);
  assert.ok(actionsForDraft(makePost({ hasLink: true })).includes('POST_LINK'));
  const graphic = actionsForDraft(makePost({ type: TweetType.GRAPHIC }));
  assert.ok(graphic.includes('AI_IMAGE_GEN') && graphic.includes('POST_GRAPHIC'));
});
