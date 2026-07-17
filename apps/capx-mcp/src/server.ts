#!/usr/bin/env -S node --experimental-strip-types
// The stdio MCP server binary — the ONLY runtime glue. It resolves host-agnostic config, builds the
// ChokepointClient (real global fetch) + CapxMcp, and registers connect_x / whoami / post_now over
// stdio. All tool logic is CapxMcp (unit-tested); this file is thin, un-unit-tested I/O wiring.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ChokepointClient, type FetchLike } from './client.ts';
import { CapxMcp } from './mcp.ts';
import { resolveClientConfig, emailHash } from './config.ts';

function readFileLayer(): Record<string, string | undefined> {
  try {
    return JSON.parse(readFileSync(join(homedir(), '.capx', 'config.json'), 'utf8')) as Record<string, string | undefined>;
  } catch {
    return {}; // absent on first run — tolerated (mergeSources)
  }
}

const fetchImpl: FetchLike = async (url, init) => {
  const res = await fetch(url, init);
  return { status: res.status, ok: res.ok, json: () => res.json(), text: () => res.text() };
};

async function main(): Promise<void> {
  const fileLayer = readFileLayer();
  const cfg = resolveClientConfig(process.env, fileLayer);
  const email = process.env.CAPX_EMAIL ?? fileLayer.CAPX_EMAIL;
  if (!email) throw new Error('CAPX_EMAIL is required (env or ~/.capx/config.json) to identify you to the chokepoint.');

  const client = new ChokepointClient(cfg.chokepointUrl, fetchImpl);
  const mcp = new CapxMcp({
    client,
    config: { emailHash: emailHash(email), lane: cfg.lane, clientId: cfg.clientId, guideUrl: `${cfg.chokepointUrl}/connect/guide` },
    now: () => Date.now(),
  });

  const server = new McpServer({ name: 'capx-cafe', version: '0.1.0' });

  server.registerTool(
    'connect_x',
    {
      description:
        'Connect (or confirm) your X account via the capx chokepoint. Call once for a consent URL; after authorizing in the browser, call again with { confirm: true }.',
      inputSchema: { confirm: z.boolean().optional(), lane: z.string().optional(), clientId: z.string().optional() },
    },
    async (args) => ({ content: [{ type: 'text', text: (await mcp.connectX(args)).text }] }),
  );

  server.registerTool(
    'whoami',
    { description: 'Show the connected X account and its status (via the chokepoint).', inputSchema: {} },
    async () => ({ content: [{ type: 'text', text: (await mcp.whoami()).text }] }),
  );

  server.registerTool(
    'post_now',
    {
      description:
        'Post text to X now. Every post passes the casserole guardrail at the chokepoint; blocked/held posts are never sent, and the token never touches this machine.',
      inputSchema: { text: z.string(), aiGenerated: z.boolean().optional(), idempotencyKey: z.string().optional() },
    },
    async (args) => ({ content: [{ type: 'text', text: (await mcp.postNow(args)).text }] }),
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
      },
    },
    async (args) => ({ content: [{ type: 'text', text: (await mcp.createLoop(args)).text }] }),
  );

  server.registerTool(
    'list_loops',
    { description: 'List your scheduled loops, their next-post queue, and whether any are paused.', inputSchema: {} },
    async () => ({ content: [{ type: 'text', text: (await mcp.listLoops()).text }] }),
  );

  server.registerTool(
    'pause_loop',
    {
      description: 'Pause or resume a loop.',
      inputSchema: { id: z.string(), paused: z.boolean().optional().describe('false to resume; defaults to true') },
    },
    async (args) => ({ content: [{ type: 'text', text: (await mcp.pauseLoop(args)).text }] }),
  );

  server.registerTool(
    'top_up_loop',
    {
      description: 'Add more posts YOU wrote to a loop\'s queue. Resumes a loop that paused because it ran out.',
      inputSchema: { id: z.string(), posts: z.array(z.string()) },
    },
    async (args) => ({ content: [{ type: 'text', text: (await mcp.topUpLoop(args)).text }] }),
  );

  server.registerTool(
    'delete_loop',
    { description: 'Delete a loop permanently.', inputSchema: { id: z.string() } },
    async (args) => ({ content: [{ type: 'text', text: (await mcp.deleteLoop(args)).text }] }),
  );

  await server.connect(new StdioServerTransport());
}

main().catch((e: unknown) => {
  process.stderr.write(`capx-mcp fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
