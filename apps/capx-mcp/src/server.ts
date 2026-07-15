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
    config: { emailHash: emailHash(email), lane: cfg.lane, clientId: cfg.clientId },
    now: () => Date.now(),
  });

  const server = new McpServer({ name: 'capx-mcp', version: '0.1.0' });

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

  await server.connect(new StdioServerTransport());
}

main().catch((e: unknown) => {
  process.stderr.write(`capx-mcp fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
