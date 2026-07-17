// Red-team suite — the adversarial proof that Option B defends the §4 critical flaw ("the harness
// writes, casserole decides what ships"). Every scenario drives the REAL stack: CapxMcp -> HTTP ->
// the in-memory chokepoint, plus direct-to-chokepoint bypass attempts. The through-line: the MCP holds
// no token and enforces nothing load-bearing; the chokepoint is the only path to X and it always
// admits + guards + honors the kill-switch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryChokepoint, LocalKeyKms } from '../../../services/chokepoint/src/index.ts';
import { ChokepointClient, type FetchLike } from '../src/client.ts';
import { CapxMcp } from '../src/mcp.ts';
import { emailHash } from '../src/config.ts';

const NOW = 1_700_000_000_000;
const EMAIL = 'founder@capx.ai';
const CLEAN =
  'Shipping the anti-slop engine today: deterministic scoring, real unit tests, and zero external keys. Here is a concrete walkthrough of the pipeline.';
// A prompt-injected scam a compromised agent might be told to post (README/tool-result injection).
const SCAM = '🚀 BUY $SCAM now!!! guaranteed 1000x, act fast! #crypto #airdrop #free #giveaway #pump #moon #100x #ape #degen';

const obj = (b: unknown) => b as Record<string, unknown>;

function wire() {
  const posted: string[] = [];
  const built = createInMemoryChokepoint({
    masterKeyBase64: LocalKeyKms.generateMasterKey(),
    signingKey: 'sign',
    adminKey: 'admin',
    oauth: { authorizeEndpoint: 'https://x.example/authorize', redirectUri: 'https://cp.example/oauth/callback', scope: 'tweet.write' },
    tokenExchange: async ({ code }) => ({ accessToken: `atok-${code}`, refreshToken: `rtok-${code}` }),
    identity: async () => ({ xUserId: 'x1', username: 'acme', verified: true, createdAtMs: 1_600_000_000_000 }),
    xPost: async ({ text }) => {
      posted.push(text);
      return { id: 'tweet-1' };
    },
    byoDefaultClientId: 'client-xyz',
    now: () => NOW,
  });
  const fetchImpl: FetchLike = async (url, init) => {
    const u = new URL(url);
    const res = await built.service.handle({
      method: init?.method ?? 'GET',
      path: u.pathname,
      query: Object.fromEntries(u.searchParams),
      body: init?.body ? JSON.parse(init.body) : undefined,
      headers: init?.headers ?? {},
    });
    return { status: res.status, ok: res.status < 400, json: async () => res.body, text: async () => JSON.stringify(res.body) };
  };
  const client = new ChokepointClient('https://cp.example', fetchImpl);
  const eh = emailHash(EMAIL);
  const mcp = new CapxMcp({ client, config: { emailHash: eh, lane: 'byo', clientId: 'client-xyz' }, now: () => NOW });
  const direct = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
    built.service.handle({ method, path, query: {}, body, headers });
  return { built, mcp, eh, posted, direct };
}

async function connect(w: ReturnType<typeof wire>) {
  await w.built.store.addAllowlisted(w.eh);
  const start = await w.mcp.connectX();
  await w.built.service.handle({ method: 'GET', path: '/oauth/callback', query: { state: String(start.data.pending_id), code: 'abc' }, body: undefined, headers: {} });
  await w.mcp.connectX({ confirm: true });
}

test('RED TEAM: prompt-injected scam via the MCP is blocked by casserole, never sent', async () => {
  const w = wire();
  await connect(w);
  const r = await w.mcp.postNow({ text: SCAM });
  assert.match(r.text, /Blocked by the guardrail/);
  assert.equal(w.posted.length, 0, 'the scam never reached X');
});

test('RED TEAM: bypassing the MCP and calling the chokepoint directly still hits casserole', async () => {
  const w = wire();
  await connect(w);
  const bearer = String(obj((await w.direct('POST', '/session', { emailHash: w.eh })).body).bearer);
  const r = await w.direct('POST', '/post_now', { text: SCAM, idempotencyKey: 'k' }, { authorization: `Bearer ${bearer}` });
  assert.equal(obj(r.body).outcome, 'blocked', 'the chokepoint re-normalizes + guards; MCP checks are not load-bearing');
  assert.equal(w.posted.length, 0);
});

test('RED TEAM: a stolen session bearer is instantly revocable (handle kill-switch)', async () => {
  const w = wire();
  await connect(w);
  const stolen = String(obj((await w.direct('POST', '/session', { emailHash: w.eh })).body).bearer);
  await w.built.admission.revoke({ handleKey: 'x1' }); // founder kills this handle
  const r = await w.direct('POST', '/post_now', { text: CLEAN, idempotencyKey: 'k' }, { authorization: `Bearer ${stolen}` });
  assert.equal(obj(r.body).outcome, 'blocked'); // even a clean post is stopped once the handle is killed
  assert.equal(w.posted.length, 0);
});

test('RED TEAM: an unallowlisted attacker cannot even get a session', async () => {
  const w = wire();
  const r = await w.direct('POST', '/session', { emailHash: emailHash('attacker@evil.example') });
  assert.equal(r.status, 403);
});

test('RED TEAM: no token material ever appears in any client-visible response', async () => {
  const w = wire();
  await connect(w);
  const who = await w.mcp.whoami();
  const post = await w.mcp.postNow({ text: CLEAN });
  const blob = JSON.stringify(who) + JSON.stringify(post);
  assert.ok(!blob.includes('atok-'), 'no access token in any response');
  assert.ok(!blob.includes('rtok-'), 'no refresh token in any response');
  assert.equal(w.posted[0], CLEAN, 'the clean post DID send — via the vaulted token, server-side only');
});

test('RED TEAM: the global kill-switch freezes all posting at once', async () => {
  const w = wire();
  await connect(w);
  await w.built.admission.revoke({ global: true });
  const r = await w.mcp.postNow({ text: CLEAN });
  assert.match(r.text, /Not posted|Blocked/);
  assert.equal(w.posted.length, 0);
});
