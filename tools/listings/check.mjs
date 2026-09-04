#!/usr/bin/env node
// Listing watchdog — checks every directory capx café was submitted to and reports what changed.
// Deterministic HTTP/API probes only (no LLM, no browser): safe to run unattended on a schedule.
//   node tools/listings/check.mjs            # human table + exit 0
//   node tools/listings/check.mjs --json     # machine output
// State is kept in tools/listings/state.json so each run can report DELTAS, not just status.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE = join(HERE, 'state.json');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const TIMEOUT_MS = 20_000;

async function http(url, { method = 'GET' } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { method, headers: { 'user-agent': UA, accept: '*/*' }, signal: ctl.signal, redirect: 'follow' });
    const body = method === 'GET' ? await r.text() : '';
    return { status: r.status, body };
  } catch (e) {
    return { status: 0, body: '', error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

/** Each check returns { state, detail } where state is LIVE | PENDING | BLOCKED | UNKNOWN. */
const CHECKS = {
  async 'mcp-registry'() {
    const { status, body } = await http('https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.vb-tyagi/capx-cafe');
    if (status !== 200) return { state: 'UNKNOWN', detail: `API ${status}` };
    const j = JSON.parse(body);
    const s = (j.servers || [])[0];
    const server = s?.server ?? s;
    return server
      ? { state: 'LIVE', detail: `${server.version} · ${s?._meta?.['io.modelcontextprotocol.registry/official']?.status ?? 'active'}` }
      : { state: 'PENDING', detail: 'not found in registry' };
  },
  async lobehub() {
    const { status, body } = await http('https://lobehub.com/mcp/vb-tyagi-capx-cafe');
    if (status !== 200) return { state: status === 404 ? 'PENDING' : 'UNKNOWN', detail: `page ${status}` };
    // the header version is crawler-derived; flag when the phantom 1.0.0 finally clears
    const unvalidated = /Unvalidated/.test(body);
    const phantom = /1\.0\.0/.test(body.slice(0, 20000));
    return { state: 'LIVE', detail: `page 200${unvalidated ? ' · still Unvalidated' : ' · validated ✓'}${phantom ? ' · phantom 1.0.0' : ' · version ok'}` };
  },
  async 'cursor-directory'() {
    // Vercel anti-bot returns 429 to non-browser clients; treat 429 as "reachable, unknown".
    const { status, body } = await http('https://cursor.directory/plugins/capx-cafe');
    if (status === 429) return { state: 'UNKNOWN', detail: '429 anti-bot (check in a browser)' };
    if (status !== 200) return { state: status === 404 ? 'PENDING' : 'UNKNOWN', detail: `page ${status}` };
    const scanning = /Scanning your plugin|unpublished and hidden/i.test(body);
    return { state: scanning ? 'PENDING' : 'LIVE', detail: scanning ? 'security scan still running' : 'public' };
  },
  async glama() {
    const { status } = await http('https://glama.ai/mcp/servers/vb-tyagi/capx-cafe');
    return status === 200
      ? { state: 'LIVE', detail: 'listing page live — claim ownership + set category Social Media, then punkpeye unblocks' }
      : { state: 'PENDING', detail: `page ${status} (in review)` };
  },
  async 'mcpservers-org'() {
    for (const u of ['https://mcpservers.org/servers/vb-tyagi/capx-cafe', 'https://mcpservers.org/servers/capx-cafe']) {
      const { status } = await http(u);
      if (status === 200) return { state: 'LIVE', detail: u };
    }
    return { state: 'PENDING', detail: 'not published yet (≤12h review stated)' };
  },
  async 'mcp-directory'() {
    for (const u of ['https://mcp.directory/mcp/capx-cafe', 'https://mcp.directory/server/capx-cafe']) {
      const { status } = await http(u);
      if (status === 200) return { state: 'LIVE', detail: u };
    }
    return { state: 'PENDING', detail: 'not published yet (≤24h stated)' };
  },
  async cline() {
    const { status, body } = await http('https://api.github.com/repos/cline/mcp-marketplace/issues/2421');
    if (status !== 200) return { state: 'UNKNOWN', detail: `GitHub API ${status}` };
    const j = JSON.parse(body);
    return j.state === 'closed'
      ? { state: 'LIVE', detail: 'issue closed — check the marketplace listing' }
      : { state: 'PENDING', detail: `issue open · ${j.comments} comment(s)` };
  },
  async pulsemcp() {
    // Should auto-ingest from the official registry once their submissions reopen.
    const { status, body } = await http('https://www.pulsemcp.com/servers?q=capx');
    if (status !== 200) return { state: 'UNKNOWN', detail: `search ${status}` };
    return /capx[- ]caf/i.test(body)
      ? { state: 'LIVE', detail: 'appears in search' }
      : { state: 'PENDING', detail: 'not ingested yet' };
  },
  async punkpeye() {
    const { status, body } = await http('https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md');
    if (status !== 200) return { state: 'UNKNOWN', detail: `README ${status}` };
    return /vb-tyagi\/capx-cafe/.test(body)
      ? { state: 'LIVE', detail: 'merged into the list' }
      : { state: 'PENDING', detail: 'not listed — PR gated on a Glama score' };
  },
  async 'docker-ghcr'() {
    // Anonymous manifest fetch — proves the ghcr packages are still PUBLIC (they default to private,
    // and a visibility flip is easy to lose on a re-push).
    const tok = await http('https://ghcr.io/token?scope=repository:vb-tyagi/capx-catalog:pull&service=ghcr.io');
    if (tok.status !== 200) return { state: 'UNKNOWN', detail: `token endpoint ${tok.status}` };
    const t = JSON.parse(tok.body).token;
    const r = await fetch('https://ghcr.io/v2/vb-tyagi/capx-catalog/manifests/latest', {
      headers: { authorization: `Bearer ${t}`, accept: 'application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json' },
    }).catch(() => null);
    if (!r) return { state: 'UNKNOWN', detail: 'manifest fetch failed' };
    return r.status === 200
      ? { state: 'LIVE', detail: 'catalog public + pullable anonymously' }
      : { state: 'BLOCKED', detail: `manifest ${r.status} — package may have gone private` };
  },
  async npm() {
    const { status, body } = await http('https://registry.npmjs.org/capx-cafe/latest');
    if (status !== 200) return { state: 'UNKNOWN', detail: `npm ${status}` };
    const j = JSON.parse(body);
    return { state: 'LIVE', detail: `${j.version} · ${j.license}` };
  },
};

const prev = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { checks: {} };
const results = {};
await Promise.all(
  Object.entries(CHECKS).map(async ([name, fn]) => {
    try {
      results[name] = await fn();
    } catch (e) {
      results[name] = { state: 'UNKNOWN', detail: `check threw: ${e instanceof Error ? e.message : String(e)}` };
    }
  }),
);

const changes = [];
for (const [name, r] of Object.entries(results)) {
  const before = prev.checks?.[name]?.state;
  if (before && before !== r.state) changes.push(`${name}: ${before} -> ${r.state}`);
  if (!before) changes.push(`${name}: (new) -> ${r.state}`);
}

const now = new Date().toISOString();
mkdirSync(HERE, { recursive: true });
writeFileSync(STATE, JSON.stringify({ lastRun: now, checks: results }, null, 2) + '\n');

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ lastRun: now, changes, checks: results }, null, 2));
} else {
  const order = ['LIVE', 'PENDING', 'UNKNOWN', 'BLOCKED'];
  const icon = { LIVE: '✅', PENDING: '🟡', UNKNOWN: '❔', BLOCKED: '❌' };
  console.log(`capx café — listing status @ ${now}\n`);
  for (const st of order) {
    const rows = Object.entries(results).filter(([, r]) => r.state === st);
    for (const [name, r] of rows) console.log(`${icon[st]} ${name.padEnd(18)} ${r.detail}`);
  }
  console.log(changes.length ? `\nCHANGES SINCE LAST RUN:\n  ${changes.join('\n  ')}` : '\nNo change since the last run.');
}
