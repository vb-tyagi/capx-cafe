import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryChokepoint, LocalKeyKms } from '../../../services/chokepoint/src/index.ts';
import { ChokepointClient } from '../src/client.ts';
import type { FetchLike } from '../src/client.ts';
import { CapxMcp } from '../src/mcp.ts';
import { emailHash, resolveClientConfig } from '../src/config.ts';

const NOW = 1_700_000_000_000;
const EMAIL = 'founder@capx.ai';
const CLEAN =
  'Shipping the anti-slop engine today: deterministic scoring, real unit tests, and zero external keys. Here is a concrete walkthrough of the pipeline.';

function wire(cfg: { clientId?: string } = { clientId: 'client-xyz' }) {
  const built = createInMemoryChokepoint({
    masterKeyBase64: LocalKeyKms.generateMasterKey(),
    signingKey: 'sign',
    adminKey: 'admin',
    oauth: { authorizeEndpoint: 'https://x.example/authorize', redirectUri: 'https://cp.example/oauth/callback', scope: 'tweet.write' },
    tokenExchange: async ({ code }) => ({ accessToken: `atok-${code}`, refreshToken: `rtok-${code}` }),
    identity: async () => ({ xUserId: 'x1', username: 'acme' }),
    xPost: async () => ({ id: 'tweet-1' }),
    byoDefaultClientId: 'client-xyz',
    now: () => NOW,
  });
  let sessionCalls = 0;
  const fetchImpl: FetchLike = async (url, init) => {
    const u = new URL(url);
    if (u.pathname === '/session') sessionCalls += 1;
    const body = init?.body ? JSON.parse(init.body) : undefined;
    const res = await built.service.handle({
      method: init?.method ?? 'GET',
      path: u.pathname,
      query: Object.fromEntries(u.searchParams),
      body,
      headers: init?.headers ?? {},
    });
    return {
      status: res.status,
      ok: res.status < 400,
      json: async () => res.body,
      text: async () => (typeof res.body === 'string' ? res.body : JSON.stringify(res.body)),
    };
  };
  const client = new ChokepointClient('https://cp.example', fetchImpl);
  const eh = emailHash(EMAIL);
  const mcp = new CapxMcp({ client, config: { emailHash: eh, lane: 'byo', clientId: cfg.clientId }, now: () => NOW });
  return { built, mcp, eh, sessionCalls: () => sessionCalls };
}

test('unallowlisted user cannot even whoami (session denied)', async () => {
  const { mcp } = wire();
  await assert.rejects(() => mcp.whoami(), /not allowlisted/);
});

test('END-TO-END: connect_x (2-phase) -> whoami -> post_now, one session', async () => {
  const w = wire();
  await w.built.store.addAllowlisted(w.eh);

  // phase 1: start
  const start = await w.mcp.connectX();
  const pendingId = String(start.data.pending_id);
  assert.match(start.text, /Open this URL/);

  // browser authorizes -> X redirects to the callback (out-of-band)
  await w.built.service.handle({ method: 'GET', path: '/oauth/callback', query: { state: pendingId, code: 'abc' }, body: undefined, headers: {} });

  // phase 2: confirm
  const confirmed = await w.mcp.connectX({ confirm: true });
  assert.equal(confirmed.data.connected, true);
  assert.equal(confirmed.data.username, 'acme');

  const who = await w.mcp.whoami();
  assert.match(who.text, /Connected as @acme on the BYO lane/);

  const posted = await w.mcp.postNow({ text: CLEAN, aiGenerated: true });
  assert.match(posted.text, /Posted to X/);
  assert.equal(posted.data.outcome, 'published');

  assert.equal(w.sessionCalls(), 1, 'the session bearer was reused across all tool calls');
});

test('post_now renders a guardrail block for spam', async () => {
  const w = wire();
  await w.built.store.addAllowlisted(w.eh);
  const start = await w.mcp.connectX();
  await w.built.service.handle({ method: 'GET', path: '/oauth/callback', query: { state: String(start.data.pending_id), code: 'abc' }, body: undefined, headers: {} });
  await w.mcp.connectX({ confirm: true });
  const spam = 'RT if you agree!!!! 🚀🚀🚀🚀🚀 #a #b #c #d #e #f #g #h #i';
  const r = await w.mcp.postNow({ text: spam });
  assert.match(r.text, /Blocked by the guardrail/);
  assert.equal(r.data.outcome, 'blocked');
});

test('BYO connect without a Client ID asks for one (no throw)', async () => {
  const w = wire({ clientId: undefined });
  await w.built.store.addAllowlisted(w.eh);
  const r = await w.mcp.connectX();
  assert.equal(r.data.needsClientId, true);
  assert.match(r.text, /Client ID/);
});

test('resolveClientConfig + emailHash', () => {
  const cfg = resolveClientConfig({ CAPX_CHOKEPOINT_URL: 'https://cp.example', CAPX_LANE: 'capx-app' });
  assert.equal(cfg.chokepointUrl, 'https://cp.example');
  assert.equal(cfg.lane, 'capx-app');
  assert.equal(emailHash('Founder@Capx.ai '), emailHash('founder@capx.ai'), 'normalized (trim + lowercase)');
  assert.match(emailHash(EMAIL), /^h_[0-9a-f]{32}$/);
});
