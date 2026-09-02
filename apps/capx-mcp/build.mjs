// Build the publishable, self-contained `capx-cafe` npm package.
//
// The dev package is @capx-cafe/mcp and depends on @capx-cafe/{core,config,platform-client} via
// workspace:* — those resolve ONLY inside this monorepo and are private, so a naive `npm publish`
// would ship a package that crashes on `Cannot find module '@capx-cafe/core'` (HANDOVER-SEEDS foot-gun #1).
//
// Fix: esbuild INLINES the workspace deps into one .mjs, and keeps the genuinely-public npm deps
// (@modelcontextprotocol/sdk, zod) EXTERNAL so npm installs them normally. Output: dist/ is a complete,
// standalone package named `capx-cafe` — `npx capx-cafe` just works, with the closed engines bundled
// (not re-published under @capx-cafe/*).
import { build } from 'esbuild';
import { mkdirSync, writeFileSync, readFileSync, copyFileSync, chmodSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('./package.json', here), 'utf8'));
mkdirSync(new URL('./dist/', here), { recursive: true });

await build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'dist/capx-cafe.mjs',
  // Keep public npm deps external; everything else (incl. @capx-cafe/* workspace deps) is inlined.
  external: ['@modelcontextprotocol/sdk', 'zod'],
  legalComments: 'none',
});

// esbuild preserves the entry file's shebang (src/server.ts uses --experimental-strip-types, which is
// WRONG for a compiled bundle). Strip any leading shebang line(s) and stamp exactly ONE clean one at
// byte 0 — Node only honors #! on line 1, and the bundle is already plain JS so no strip-types flag.
const outPath = new URL('./dist/capx-cafe.mjs', here);
let code = readFileSync(outPath, 'utf8').replace(/^(#![^\n]*\n)+/, '');
writeFileSync(outPath, '#!/usr/bin/env node\n' + code);
chmodSync(outPath, 0o755);

const publishPkg = {
  name: 'capx-cafe',
  version: pkg.version,
  // Official MCP registry ownership check reads this from the live package.json on npm.
  mcpName: 'io.github.vb-tyagi/capx-cafe',
  description:
    'Agent-native X posting for Claude Code / Cursor / Codex / Windsurf. Connect X, post, and schedule from inside your agent — every post passes a server-side guardrail; the token never touches your machine.',
  type: 'module',
  // npm 12 rejects a leading './' in bin paths ("script name was invalid") and would strip the
  // bin entirely at publish — breaking `npx capx-cafe`. Bare relative path is the valid form.
  bin: { 'capx-cafe': 'capx-cafe.mjs' },
  dependencies: {
    '@modelcontextprotocol/sdk': pkg.dependencies['@modelcontextprotocol/sdk'],
    zod: pkg.dependencies.zod,
  },
  engines: { node: '>=22' },
  files: ['capx-cafe.mjs', 'README.md'],
  license: 'MIT',
  homepage: 'https://github.com/vb-tyagi/capx-cafe#readme',
  repository: { type: 'git', url: 'git+https://github.com/vb-tyagi/capx-cafe.git' },
  bugs: { url: 'https://github.com/vb-tyagi/capx-cafe/issues' },
  keywords: ['mcp', 'model-context-protocol', 'claude', 'claude-code', 'cursor', 'codex', 'windsurf', 'x', 'twitter', 'agent', 'ai-agent', 'posting', 'scheduling'],
};
writeFileSync(new URL('./dist/package.json', here), JSON.stringify(publishPkg, null, 2) + '\n');
copyFileSync(new URL('./README.md', here), new URL('./dist/README.md', here));

console.log('bundled -> dist/capx-cafe.mjs');
console.log('publish package -> dist/package.json  (name: capx-cafe, deps: sdk+zod only)');
