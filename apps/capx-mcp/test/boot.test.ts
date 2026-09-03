// Introspection-friendly boot. Directory crawlers (Glama, cursor.directory, the MCP registry) start the
// binary with NO env and call initialize + tools/list — the server must boot and answer. A tool call
// made without config must come back as an actionable isError result: never a throw, never an exit.
// With config present, the same server drives the real tool path unchanged. Everything runs the real
// McpServer over the SDK's in-memory transport, so what a crawler sees is what is asserted here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createInMemoryChokepoint, LocalKeyKms } from '../../../services/chokepoint/src/index.ts';
import type { FetchLike } from '../src/client.ts';
import { createServer, resolveRuntime, type ServerDeps } from '../src/app.ts';
import { CAPX_VERSION } from '../src/version.ts';
import { emailHash } from '../src/config.ts';

const NOW = 1_700_000_000_000;
const EMAIL = 'founder@capx.ai';
const ALL_TOOLS = ['connect_x', 'whoami', 'post_now', 'preview', 'audit', 'upload_media', 'create_loop', 'list_loops', 'pause_loop', 'top_up_loop', 'delete_loop'];
const NOT_CONFIGURED = /^capx café is not configured: set CAPX_CHOKEPOINT_URL and CAPX_EMAIL/;

interface ToolReply {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
}
const textOf = (r: ToolReply): string => r.content[0]?.text ?? '';

/** Boot the real server over an in-memory transport and hand back a crawler-shaped client. */
async function boot(deps: ServerDeps) {
  const server = createServer(deps);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'directory-crawler', version: '0.0.0' });
  await client.connect(clientTransport);
  const call = async (name: string, args: Record<string, unknown> = {}): Promise<ToolReply> =>
    (await client.callTool({ name, arguments: args })) as ToolReply;
  return { client, call, close: () => client.close() };
}

/** A crawler's view: nothing in the environment, no ~/.capx/config.json. */
const NO_CONFIG: ServerDeps = { env: {}, readFileLayer: () => ({}) };

test('BOOT: with NO env at all, initialize + tools/list answer (crawler introspection)', async () => {
  const b = await boot(NO_CONFIG);
  const info = b.client.getServerVersion();
  assert.equal(info?.name, 'capx-cafe');
  assert.equal(info?.version, CAPX_VERSION);
  const { tools } = await b.client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), [...ALL_TOOLS].sort());
  await b.close();
});

test('VERSION: serverInfo.version comes from package.json, not a hardcoded literal', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
  assert.equal(CAPX_VERSION, pkg.version);
  assert.match(CAPX_VERSION, /^\d+\.\d+\.\d+/);
});

test('NO CONFIG: a tool call returns an actionable isError result — no throw, no exit', async () => {
  const b = await boot(NO_CONFIG);
  const who = await b.call('whoami');
  assert.equal(who.isError, true);
  assert.match(textOf(who), NOT_CONFIGURED);
  assert.match(textOf(who), /README quickstart/);
  // every tool is gated the same way, including one with required arguments
  const post = await b.call('post_now', { text: 'hello' });
  assert.equal(post.isError, true);
  assert.match(textOf(post), NOT_CONFIGURED);
  // ...and the server is still alive and answering afterwards
  const { tools } = await b.client.listTools();
  assert.equal(tools.length, ALL_TOOLS.length);
  await b.close();
});

test('PARTIAL CONFIG: the error names only what is missing', async () => {
  const b = await boot({ env: { CAPX_CHOKEPOINT_URL: 'https://cp.example' }, readFileLayer: () => ({}) });
  const r = await b.call('whoami');
  assert.equal(r.isError, true);
  assert.match(textOf(r), /^capx café is not configured: set CAPX_EMAIL \(/);
  await b.close();
});

test('INVALID CONFIG: a validation problem surfaces in the same actionable shape', () => {
  const r = resolveRuntime({ CAPX_CHOKEPOINT_URL: 'not-a-url', CAPX_EMAIL: EMAIL }, {});
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /^capx café is not configured: CAPX_CHOKEPOINT_URL must be a valid URL/);
});

test('FILE LAYER: ~/.capx/config.json is re-read on each call until config resolves (first-run flow)', async () => {
  let file: Record<string, string> = {};
  const seen: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    seen.push(url);
    return { status: 403, ok: false, json: async () => ({ error: 'not allowlisted' }), text: async () => '' };
  };
  const b = await boot({ env: {}, readFileLayer: () => file, fetchImpl });
  assert.equal((await b.call('whoami')).isError, true);
  assert.equal(seen.length, 0, 'nothing is fetched before config exists');
  file = { CAPX_CHOKEPOINT_URL: 'https://cp.example', CAPX_EMAIL: EMAIL };
  const r = await b.call('whoami');
  assert.doesNotMatch(textOf(r), NOT_CONFIGURED, 'the gate opened once the file appeared');
  assert.deepEqual(seen, ['https://cp.example/session'], 'the call reached the chokepoint');
  assert.equal(r.isError, true, 'a chokepoint rejection is still an isError result, not a crash');
  assert.match(textOf(r), /not allowlisted/);
  await b.close();
});

test('CONFIG PRESENT: the same server drives the real tool path unchanged — one lazily-built session', async () => {
  const built = createInMemoryChokepoint({
    masterKeyBase64: LocalKeyKms.generateMasterKey(),
    signingKey: 'sign',
    adminKey: 'admin',
    oauth: { authorizeEndpoint: 'https://x.example/authorize', redirectUri: 'https://cp.example/oauth/callback', scope: 'tweet.write' },
    tokenExchange: async ({ code }) => ({ accessToken: `atok-${code}`, refreshToken: `rtok-${code}` }),
    identity: async () => ({ xUserId: 'x1', username: 'acme', verified: true, createdAtMs: 1_600_000_000_000 }),
    xPost: async () => ({ id: 'tweet-1' }),
    byoDefaultClientId: 'test-client-id-0123456789',
    now: () => NOW,
  });
  let sessionCalls = 0;
  const fetchImpl: FetchLike = async (url, init) => {
    const u = new URL(url);
    if (u.pathname === '/session') sessionCalls += 1;
    const res = await built.service.handle({
      method: init?.method ?? 'GET',
      path: u.pathname,
      query: Object.fromEntries(u.searchParams),
      body: init?.body ? JSON.parse(init.body) : undefined,
      headers: init?.headers ?? {},
    });
    return { status: res.status, ok: res.status < 400, json: async () => res.body, text: async () => JSON.stringify(res.body) };
  };
  await built.store.addAllowlisted(emailHash(EMAIL));

  const b = await boot({
    env: { CAPX_CHOKEPOINT_URL: 'https://cp.example', CAPX_EMAIL: EMAIL, X_CLIENT_ID: 'test-client-id-0123456789' },
    readFileLayer: () => ({}),
    fetchImpl,
    now: () => NOW,
  });
  const who = await b.call('whoami');
  assert.notEqual(who.isError, true);
  assert.match(textOf(who), /No X account connected/);
  const start = await b.call('connect_x');
  assert.match(textOf(start), /Open this URL/);
  assert.equal(sessionCalls, 1, 'ONE CapxMcp is built lazily and reused — the session bearer is shared across calls');
  await b.close();
});
