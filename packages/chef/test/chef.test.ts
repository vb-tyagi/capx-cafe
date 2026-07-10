import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockContentProvider, runGeneration, validateRequest } from '../src/index.ts';
import type { GenerationRequest } from '../src/index.ts';
import { TweetType } from '../../core/src/index.ts';

const req = (o: Partial<GenerationRequest> = {}): GenerationRequest => ({
  type: TweetType.TEXT,
  category: 'shipping updates',
  brief: 'a specific update on the canteen loops pipeline: scheduling, the guard chokepoint, and credit metering',
  tags: ['build', 'shipping'],
  styleSources: ['@dhh'],
  model: 'claude',
  handleId: 'h1',
  loopId: 'loop1',
  ...o,
});

test('validateRequest rejects bad requests', () => {
  assert.equal(validateRequest(req()).ok, true);
  assert.equal(validateRequest(req({ brief: '' })).ok, false);
  assert.equal(validateRequest(req({ category: '' })).ok, false);
  assert.equal(validateRequest(req({ styleSources: ['@a', '@b', '@c', '@d'] })).ok, false);
  assert.equal(validateRequest(req({ brief: 'x'.repeat(5000) })).ok, false);
});

test('mock provider is deterministic and returns a DraftPost', async () => {
  const p = new MockContentProvider();
  const a = await p.generate(req());
  const b = await p.generate(req());
  assert.equal(a.text, b.text);
  assert.equal(a.aiGenerated, true);
  assert.equal(a.type, TweetType.TEXT);
  assert.ok(a.text.length > 40);
});

test('runGeneration validates before generating', async () => {
  const p = new MockContentProvider();
  assert.equal((await runGeneration(p, req())).ok, true);
  assert.equal((await runGeneration(p, req({ styleSources: ['@a', '@b', '@c', '@d'] }))).ok, false);
});

test('SPAMTEST marker makes the mock emit content the guard will block', async () => {
  const p = new MockContentProvider();
  const d = await p.generate(req({ brief: 'SPAMTEST please' }));
  assert.match(d.text, /follow for follow|🚀/);
});
