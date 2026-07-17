import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runLoopFromBrief } from '../src/index.ts';
import { MockContentProvider } from '@capx-cafe/chef';
import type { GenerationRequest } from '@capx-cafe/chef';
import { FakePlatformClient } from '@capx-cafe/platform-client';
import { CreditLedger } from '@capx-cafe/counter';
import type { GauntletContext } from '@capx-cafe/casserole';
import { Tier, Platform, TweetType, Autonomy, AccountStanding } from '@capx-cafe/core';
import type { Handle, LoopConfig } from '@capx-cafe/core';

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;

const handle = (): Handle => ({
  id: 'h1', workspaceId: 'w1', platform: Platform.X, username: 'acme',
  verified: true, ageDays: 120, standing: AccountStanding.GOOD, connectedAt: NOW - 200 * 24 * HOUR,
});
const loop = (): LoopConfig => ({
  id: 'loop1', handleId: 'h1', timeOfDayMinutes: 540, daysOfWeek: [1, 3, 5], type: TweetType.TEXT,
  model: 'claude', category: 'shipping updates', tags: ['build'], brief: 'x', styleSources: ['@dhh'],
  autonomy: Autonomy.AUTONOMOUS, trainingWheelsRemaining: 0,
});
const ctx = (): GauntletContext => ({
  tier: Tier.TEAM, handle: handle(), loop: loop(), history: [], now: NOW, accountDailyCeiling: 10,
  killSwitch: { global: false, handle: false },
});
const genReq = (o: Partial<GenerationRequest> = {}): GenerationRequest => ({
  type: TweetType.TEXT,
  category: 'shipping updates',
  brief: 'a specific update on the canteen loops pipeline: scheduling, the guard chokepoint, credit metering, and the fake publish adapter now run together',
  tags: ['build'],
  styleSources: ['@dhh'],
  model: 'claude',
  handleId: 'h1',
  loopId: 'loop1',
  ...o,
});

test('END-TO-END: brief → chef → casserole → counter → cafe publishes', async () => {
  const ledger = new CreditLedger('TEAM', 1000);
  const client = new FakePlatformClient();
  const out = await runLoopFromBrief(genReq(), ctx(), ledger, client, new MockContentProvider());
  assert.equal(out.stage, 'pipeline');
  if (out.stage !== 'pipeline') return;
  assert.equal(out.result.outcome, 'published');
  assert.equal(client.calls.length, 1);
  assert.ok(out.result.creditsCharged > 0);
  assert.ok(out.draft.aiGenerated);
});

test('END-TO-END: chef-generated spam is blocked at the casserole chokepoint', async () => {
  const ledger = new CreditLedger('TEAM', 1000);
  const client = new FakePlatformClient();
  const out = await runLoopFromBrief(genReq({ brief: 'SPAMTEST' }), ctx(), ledger, client, new MockContentProvider());
  assert.equal(out.stage, 'pipeline');
  if (out.stage !== 'pipeline') return;
  assert.equal(out.result.outcome, 'blocked');
  assert.equal(client.calls.length, 0);
  assert.equal(ledger.getBalance(), 1000);
});

test('END-TO-END: chef rejects an invalid brief before the pipeline runs', async () => {
  const ledger = new CreditLedger('TEAM', 1000);
  const client = new FakePlatformClient();
  const out = await runLoopFromBrief(genReq({ styleSources: ['@a', '@b', '@c', '@d'] }), ctx(), ledger, client, new MockContentProvider());
  assert.equal(out.stage, 'generation');
  assert.equal(client.calls.length, 0);
});
