#!/usr/bin/env -S node --experimental-strip-types
// The stdio MCP server binary — the ONLY runtime glue: compose the app (src/app.ts) and attach stdio.
// It boots with NO configuration (directory crawlers introspect initialize + tools/list); config is
// checked per tool call inside the app. This file is thin, un-unit-tested I/O wiring — everything
// else (tools, the lazy config gate, the version stamp) is unit-tested via an in-memory transport.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './app.ts';

async function main(): Promise<void> {
  await createServer().connect(new StdioServerTransport());
}

main().catch((e: unknown) => {
  process.stderr.write(`capx-mcp fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
