// The composed MCP application: tool registration + LAZY configuration.
//
// The server ALWAYS boots and answers `initialize` / `tools/list` with no configuration at all —
// directory crawlers (Glama, cursor.directory, the MCP registry) start the binary with no env and
// introspect it. Config is resolved on the first TOOL CALL instead: a tool invoked before
// CAPX_CHOKEPOINT_URL / CAPX_EMAIL exist returns an actionable `isError` result, never a throw and
// never a process exit. With config present, behaviour is unchanged from the eager-boot days: ONE
// ChokepointClient + ONE CapxMcp (session bearer + pending-connect state) shared across every call.
//
// Everything here is unit-tested through an in-memory transport (test/boot.test.ts); src/server.ts is
// the only un-tested line — it attaches stdio.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { EnvValidationError, mergeSources } from '@capx-cafe/config';
import { ChokepointClient, type FetchLike } from './client.ts';
import { CapxMcp, type MediaReader, type ToolResult } from './mcp.ts';
import { resolveClientConfig, emailHash } from './config.ts';
import { CAPX_VERSION } from './version.ts';

export const SERVER_NAME = 'capx-cafe';
const QUICKSTART_URL = 'https://github.com/vb-tyagi/capx-cafe#60-second-quickstart';
/** The two values every tool needs before it can talk to the chokepoint (env or ~/.capx/config.json). */
const REQUIRED = ['CAPX_CHOKEPOINT_URL', 'CAPX_EMAIL'] as const;

export type ConfigLayer = Record<string, string | undefined>;

export interface ServerDeps {
  /** the process environment layer; injectable so tests boot with a controlled (or empty) env. */
  env?: ConfigLayer;
  /** the non-secret ~/.capx/config.json layer; re-read on every attempt until config resolves. */
  readFileLayer?: () => ConfigLayer;
  fetchImpl?: FetchLike;
  now?: () => number;
  readMedia?: MediaReader;
}

export type Runtime =
  | { ok: true; chokepointUrl: string; lane: 'byo' | 'capx-app'; clientId?: string; email: string }
  | { ok: false; error: string };

/** ~/.capx/config.json — absent on first run, which is tolerated (an empty layer). */
export function readHomeFileLayer(): ConfigLayer {
  try {
    return JSON.parse(readFileSync(join(homedir(), '.capx', 'config.json'), 'utf8')) as ConfigLayer;
  } catch {
    return {};
  }
}

const defaultFetch: FetchLike = async (url, init) => {
  const res = await fetch(url, init);
  return { status: res.status, ok: res.ok, json: () => res.json(), text: () => res.text() };
};

function notConfigured(detail: string): string {
  return `capx café is not configured: ${detail} (env or ~/.capx/config.json — see the README quickstart: ${QUICKSTART_URL})`;
}

/**
 * Resolve the client config + the identity email from the layered sources WITHOUT throwing. Names
 * exactly what is missing so the agent (or the human reading its transcript) can fix it in one step.
 */
export function resolveRuntime(env: ConfigLayer, fileLayer: ConfigLayer): Runtime {
  const merged = mergeSources(env, fileLayer);
  const missing = REQUIRED.filter((k) => !merged[k]);
  if (missing.length) return { ok: false, error: notConfigured(`set ${missing.join(' and ')}`) };
  try {
    const cfg = resolveClientConfig(merged);
    return { ok: true, ...cfg, email: String(merged.CAPX_EMAIL) };
  } catch (e) {
    const detail = e instanceof EnvValidationError ? e.problems.join('; ') : e instanceof Error ? e.message : String(e);
    return { ok: false, error: notConfigured(detail) };
  }
}

export function createServer(deps: ServerDeps = {}): McpServer {
  const env = deps.env ?? process.env;
  const readFileLayer = deps.readFileLayer ?? readHomeFileLayer;
  const fetchImpl = deps.fetchImpl ?? defaultFetch;
  const now = deps.now ?? (() => Date.now());

  let mcp: CapxMcp | null = null;
  /** Build the tool layer on first use; until config resolves every call gets the same actionable error. */
  function ready(): { mcp: CapxMcp } | { error: string } {
    if (mcp) return { mcp };
    const rt = resolveRuntime(env, readFileLayer());
    if (!rt.ok) return { error: rt.error };
    mcp = new CapxMcp({
      client: new ChokepointClient(rt.chokepointUrl, fetchImpl),
      config: { emailHash: emailHash(rt.email), lane: rt.lane, clientId: rt.clientId, guideUrl: `${rt.chokepointUrl}/connect/guide` },
      now,
      readMedia: deps.readMedia,
    });
    return { mcp };
  }

  /** Run one tool: the config gate first (an isError result, never a throw), then the CapxMcp call. */
  async function run(fn: (m: CapxMcp) => Promise<ToolResult>): Promise<CallToolResult> {
    const r = ready();
    if ('error' in r) return { isError: true, content: [{ type: 'text', text: r.error }] };
    return { content: [{ type: 'text', text: (await fn(r.mcp)).text }] };
  }

  const server = new McpServer({ name: SERVER_NAME, version: CAPX_VERSION });

  server.registerTool(
    'connect_x',
    {
      description:
        'Connect (or confirm) your X account via the capx chokepoint. Call once for a consent URL; after authorizing in the browser, call again with { confirm: true }.',
      inputSchema: { confirm: z.boolean().optional(), lane: z.string().optional(), clientId: z.string().optional() },
    },
    async (args) => run((m) => m.connectX(args)),
  );

  server.registerTool(
    'whoami',
    { description: 'Show the connected X account and its status (via the chokepoint).', inputSchema: {} },
    async () => run((m) => m.whoami()),
  );

  server.registerTool(
    'post_now',
    {
      description:
        'Post text to X now. Every post passes the casserole guardrail at the chokepoint; blocked/held posts are never sent, and the token never touches this machine. Set aiGenerated only if the user wants this post labelled AI-assisted (default off — it is the user\'s choice). Pass inReplyToId with a prior post\'s platformPostId to chain a native reply/thread.',
      inputSchema: {
        text: z.string(),
        aiGenerated: z.boolean().optional().describe('label this post AI-assisted — the USER decides; default false'),
        idempotencyKey: z.string().optional(),
        inReplyToId: z.string().optional().describe('platformPostId of the post this replies to (for threads)'),
        mediaIds: z.array(z.string()).optional().describe('media ids from upload_media to attach to this post'),
      },
    },
    async (args) => run((m) => m.postNow(args)),
  );

  server.registerTool(
    'preview',
    {
      description:
        'Dry-run a draft through the casserole guardrail WITHOUT posting: returns whether it would pass, be held, or be blocked, and why. Use it to fix a draft before posting or scheduling. This is a linter, never a way to bypass the guard.',
      inputSchema: { text: z.string(), aiGenerated: z.boolean().optional() },
    },
    async (args) => run((m) => m.preview(args)),
  );

  server.registerTool(
    'audit',
    {
      description:
        'Show the durable history of what capx has posted or attempted on your behalf (most recent first, with delivery state). A trust feature — read-only, your own handle only.',
      inputSchema: { limit: z.number().optional().describe('max rows (default 50)') },
    },
    async (args) => run((m) => m.auditTrail(args)),
  );

  server.registerTool(
    'upload_media',
    {
      description:
        'Upload a local image or video (produced by your own media tool) so it can be attached to a post. Reads the file, streams the bytes to the chokepoint, and returns a media id to pass to post_now as mediaIds. Media is not moderated by casserole — you set the AI-content label per the media skills.',
      inputSchema: { path: z.string().describe('local file path to the image/video, e.g. ./out/hero.png') },
    },
    async (args) => run((m) => m.uploadMedia(args)),
  );

  server.registerTool(
    'create_loop',
    {
      description:
        'Schedule recurring posts. YOU (the agent) must write the posts and pass them in `posts` — capx never generates content, so at fire time it only ships text you already wrote. When the queue empties the loop pauses and asks for more. Requires a verified X account at least 30 days old.',
      inputSchema: {
        time: z.string().describe('local time, HH:MM, e.g. "09:00"'),
        daysOfWeek: z.array(z.number()).describe('0=Sunday .. 6=Saturday, e.g. [1,3,5]'),
        posts: z.array(z.string()).describe('the posts YOU wrote; one is sent per fire, in order'),
        timezone: z.string().optional().describe('IANA zone (defaults to this machine\'s), e.g. Asia/Kolkata'),
        aiGenerated: z.boolean().optional().describe('label this loop\'s posts AI-assisted — the USER decides; default false'),
      },
    },
    async (args) => run((m) => m.createLoop(args)),
  );

  server.registerTool(
    'list_loops',
    { description: 'List your scheduled loops, their next-post queue, and whether any are paused.', inputSchema: {} },
    async () => run((m) => m.listLoops()),
  );

  server.registerTool(
    'pause_loop',
    {
      description: 'Pause or resume a loop.',
      inputSchema: { id: z.string(), paused: z.boolean().optional().describe('false to resume; defaults to true') },
    },
    async (args) => run((m) => m.pauseLoop(args)),
  );

  server.registerTool(
    'top_up_loop',
    {
      description: 'Add more posts YOU wrote to a loop\'s queue. Resumes a loop that paused because it ran out.',
      inputSchema: { id: z.string(), posts: z.array(z.string()) },
    },
    async (args) => run((m) => m.topUpLoop(args)),
  );

  server.registerTool(
    'delete_loop',
    { description: 'Delete a loop permanently.', inputSchema: { id: z.string() } },
    async (args) => run((m) => m.deleteLoop(args)),
  );

  return server;
}
