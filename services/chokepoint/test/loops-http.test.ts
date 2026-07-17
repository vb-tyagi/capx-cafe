// The Loops HTTP surface, end-to-end through the real service: create -> list -> tick -> posted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryChokepoint, LocalKeyKms } from '../src/index.ts';
import { jitterMinutes } from '../src/loops/schedule.ts';

const CLEAN = 'Shipping the anti-slop engine today: deterministic scoring, real unit tests, and a concrete walkthrough of the pipeline.';
const NOW0 = Date.parse('2026-07-17T03:30:00Z'); // 09:00 Friday in Kolkata
const obj = (b: unknown) => b as Record<string, unknown>;

function wire() {
  const posted: string[] = [];
  let clock = NOW0;
  const built = createInMemoryChokepoint({
    masterKeyBase64: LocalKeyKms.generateMasterKey(),
    signingKey: 'sign',
    adminKey: 'admin-secret',
    oauth: { authorizeEndpoint: 'https://x.example/authorize', redirectUri: 'https://cp.example/oauth/callback', scope: 'tweet.write' },
    tokenExchange: async ({ code }) => ({ accessToken: `atok-${code}`, refreshToken: `rtok-${code}` }),
    identity: async () => ({ xUserId: 'x1', username: 'acme', verified: true, createdAtMs: NOW0 - 400 * 86_400_000 }),
    xPost: async ({ text }) => {
      posted.push(text);
      return { id: `tw-${posted.length}` };
    },
    byoDefaultClientId: 'client-xyz',
    now: () => clock,
  });
  const h = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
    built.service.handle({ method, path, body, headers, query: {} });
  return { built, posted, h, setClock: (t: number) => { clock = t; } };
}

async function connectedBearer(w: ReturnType<typeof wire>) {
  await w.built.service.handle({ method: 'POST', path: '/admin/allow', body: { email: 'founder@capx.ai' }, headers: { 'x-admin-key': 'admin-secret' }, query: {} });
  const eh = obj((await w.h('POST', '/admin/allow', { email: 'founder@capx.ai' }, { 'x-admin-key': 'admin-secret' })).body).emailHash as string;
  const bearer = String(obj((await w.h('POST', '/session', { emailHash: eh })).body).bearer);
  const start = obj((await w.h('POST', '/oauth/start', { lane: 'BYO' }, { authorization: `Bearer ${bearer}` })).body);
  await w.built.service.handle({ method: 'GET', path: '/oauth/callback', query: { state: String(start.pendingId), code: 'abc' }, body: undefined, headers: {} });
  await w.h('POST', '/oauth/confirm', { pendingId: start.pendingId, sessionNonce: start.sessionNonce }, { authorization: `Bearer ${bearer}` });
  return bearer;
}

test('END-TO-END: create a loop over HTTP, tick, and it posts', async () => {
  const w = wire();
  const bearer = await connectedBearer(w);
  const auth = { authorization: `Bearer ${bearer}` };

  const created = await w.h('POST', '/loops/create', { timezone: 'Asia/Kolkata', timeOfDayMinutes: 540, daysOfWeek: [5], posts: [CLEAN] }, auth);
  assert.equal(created.status, 200);
  const loop = obj(obj(created.body).loop);
  assert.equal(loop.paused, false);

  const listed = await w.h('POST', '/loops/list', {}, auth);
  assert.equal((obj(listed.body).loops as unknown[]).length, 1);

  // before the target -> tick does nothing
  w.setClock(NOW0 - 60 * 60_000);
  assert.equal(obj((await w.h('POST', '/internal/tick', {}, { 'x-admin-key': 'admin-secret' })).body).fired, 0);
  assert.equal(w.posted.length, 0);

  // at the target -> it fires
  w.setClock(NOW0 + jitterMinutes(String(loop.id), '2026-07-17') * 60_000);
  const tick = await w.h('POST', '/internal/tick', {}, { 'x-admin-key': 'admin-secret' });
  assert.equal(obj(tick.body).fired, 1, JSON.stringify(tick.body));
  assert.deepEqual(w.posted, [CLEAN]);
});

test('create_loop with no posts is refused (capx generates nothing)', async () => {
  const w = wire();
  const bearer = await connectedBearer(w);
  const r = await w.h('POST', '/loops/create', { timezone: 'Asia/Kolkata', timeOfDayMinutes: 540, daysOfWeek: [5], posts: [] }, { authorization: `Bearer ${bearer}` });
  assert.equal(r.status, 400);
  assert.match(JSON.stringify(r.body), /does not generate content/);
});

test('loops endpoints require a session; tick requires the admin key', async () => {
  const w = wire();
  assert.equal((await w.h('POST', '/loops/list', {})).status, 401);
  assert.equal((await w.h('POST', '/loops/create', {})).status, 401);
  assert.equal((await w.h('POST', '/internal/tick', {}, { 'x-admin-key': 'wrong' })).status, 403);
  assert.equal((await w.h('POST', '/internal/tick', {})).status, 403);
});

test('a loop is invisible to another user (owner-scoped over HTTP)', async () => {
  const w = wire();
  const mine = await connectedBearer(w);
  const created = await w.h('POST', '/loops/create', { timezone: 'Asia/Kolkata', timeOfDayMinutes: 540, daysOfWeek: [5], posts: [CLEAN] }, { authorization: `Bearer ${mine}` });
  const id = String(obj(obj(created.body).loop).id);

  // a different allowlisted user
  const otherHash = obj((await w.h('POST', '/admin/allow', { email: 'other@capx.ai' }, { 'x-admin-key': 'admin-secret' })).body).emailHash as string;
  const other = String(obj((await w.h('POST', '/session', { emailHash: otherHash })).body).bearer);

  assert.equal((obj((await w.h('POST', '/loops/list', {}, { authorization: `Bearer ${other}` })).body).loops as unknown[]).length, 0);
  assert.equal((await w.h('POST', '/loops/delete', { id }, { authorization: `Bearer ${other}` })).status, 404);
  assert.equal((await w.h('POST', '/loops/pause', { id }, { authorization: `Bearer ${other}` })).status, 404);
});
