// Demo driver for the launch GIF (recorded with vhs — see tools/demo/capx-demo.tape).
// Every verdict on screen is REAL: the actual chokepoint composition (admission → casserole →
// vault → x-adapter) runs in-process over the in-memory store, with X faked at the adapter
// boundary. Nothing is staged: the BLOCK reasons and the PASS come from casserole itself.
// DEMO_FAST=1 disables the pacing sleeps (used to smoke-test the script).
import { InMemoryStore } from '../../services/chokepoint/src/store/memory.ts';
import { LocalKeyKms } from '../../services/chokepoint/src/vault/kms.ts';
import { Vault } from '../../services/chokepoint/src/vault/index.ts';
import { HmacSessionSigner } from '../../services/chokepoint/src/admission/session.ts';
import { Admission } from '../../services/chokepoint/src/admission/index.ts';
import { Outbox } from '../../services/chokepoint/src/outbox/index.ts';
import { PublishGate } from '../../services/chokepoint/src/gate/index.ts';
import { FakePlatformClient } from '../../packages/platform-client/src/index.ts';

const FAST = process.env.DEMO_FAST === '1';
const sleep = (ms: number): Promise<void> => (FAST ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));
const out = (s: string): void => void process.stdout.write(s);

// ANSI
const dim = (s: string): string => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string): string => `\x1b[1m${s}\x1b[0m`;
const green = (s: string): string => `\x1b[32m${s}\x1b[0m`;
const red = (s: string): string => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string): string => `\x1b[33m${s}\x1b[0m`;
const cyan = (s: string): string => `\x1b[36m${s}\x1b[0m`;

async function typeLine(s: string, cps = 260): Promise<void> {
  for (const ch of s) {
    out(ch);
    await sleep(1000 / cps);
  }
  out('\n');
}

const SCAM = 'RT if you agree!!!! 🚀🚀🚀🚀🚀🚀🚀 #crypto #web3 #airdrop #free #giveaway #now';
const GOOD =
  'Shipped the token-refresh fix today: on a 401 the gate refreshes the token server-side and retries the send once. All 238 tests green.';

async function main(): Promise<void> {
  const store = new InMemoryStore();
  const vault = new Vault(store, new LocalKeyKms(LocalKeyKms.generateMasterKey()), () => Date.now());
  await store.addAllowlisted('h_demo');
  await vault.put(
    { emailHash: 'h_demo', xUserId: 'x_demo', username: 'acme_dev', lane: 'BYO', standing: 'GOOD', verified: true, createdAtMs: Date.now() - 400 * 86_400_000 },
    { access: 'demo-access-token', refresh: 'demo-refresh-token' },
  );
  const admission = new Admission(store, new HmacSessionSigner('demo-signing-key', 15 * 60_000, 12 * 60 * 60_000));
  const gate = new PublishGate({ admission, vault, client: new FakePlatformClient(), now: () => Date.now(), outbox: new Outbox(store) });
  const bearer = admission.issueSession('h_demo', Date.now());

  out('\n');
  out(`  ${bold('☕ capx café')} ${dim('— the guardrail, live (sandbox: real chokepoint code, X faked at the boundary)')}\n\n`);
  await sleep(1200);

  out(`  ${green('✓')} @acme_dev connected — token ${bold('sealed in the server vault')}\n`);
  out(`    ${dim('this machine holds: a short-lived session handle. no token. nothing to steal.')}\n\n`);
  await sleep(1800);

  // ① a prompt-injected / slop draft
  out(`  ${yellow('①')} the agent got prompt-injected into drafting:\n`);
  out('     ');
  await typeLine(dim(`"${SCAM}"`));
  await sleep(600);
  const blocked = await gate.preview({ bearer, text: SCAM, aiGenerated: true });
  out(`     casserole → ${red(bold(`✖ ${blocked.verdict}`))}\n`);
  for (const r of blocked.finalReasons.slice(0, 3)) out(`       ${red('·')} ${dim(r)}\n`);
  out(`     ${bold('🔒 the token was never even decrypted')} ${dim('— a blocked post cannot reach the vault')}\n\n`);
  await sleep(2600);

  // ② a real build update
  out(`  ${yellow('②')} the agent drafts a real build update:\n`);
  out('     ');
  await typeLine(dim(`"${GOOD}"`));
  await sleep(600);
  const posted = await gate.postNow({ bearer, text: GOOD, aiGenerated: true, idempotencyKey: 'demo-1' });
  out(`     casserole → ${green(bold('✔ PASS'))} ${dim('(6 deterministic layers)')}\n`);
  await sleep(700);
  out(`     vault → x-adapter → ${green(bold('posted ✓'))} ${dim(`id ${posted.platformPostId}`)}\n\n`);
  await sleep(2000);

  // ③ the durable audit
  const audit = await gate.audit({ bearer });
  out(`  ${yellow('③')} the durable audit trail ${dim('(everything capx ever sent or tried, per account)')}\n`);
  for (const e of audit.entries) out(`     ${cyan(e.state)}  ${dim(`"${e.text.slice(0, 58)}…"`)}\n`);
  out('\n');
  await sleep(2200);

  out(`  ${bold('Your X token never touched this machine.')}\n`);
  out(`  ${dim('one MCP server · Claude Code / Cursor / Codex / Windsurf')}  ${cyan('capx-cafe.vercel.app')}\n\n`);
  await sleep(3000);
}

main().catch((e: unknown) => {
  process.stderr.write(String(e instanceof Error ? e.stack : e));
  process.exit(1);
});
