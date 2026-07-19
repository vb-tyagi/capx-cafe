# capx café — Terms of Service

> **Status: FINAL — locked 2026-07-19 (counsel-reviewed).** The bracketed `[CONFIRM: …]` fields hold
> company-specific values (legal entity, governing law, liability cap) to slot in before public launch;
> everything else is locked. Architecture of record: `../P1-CHOKEPOINT.md`, `../STATE.md`.

**Effective date:** 2026-07-19 · **Entity:** [CONFIRM: legal entity name + registered address] ·
**Contact:** legal@capx.ai

---

## 1. What capx café is (and is not)

capx café ("**capx**", "**we**") is an open-source tool that lets a whitelisted user connect their own X
(formerly Twitter) account and then create, schedule, and publish posts to X **from inside their own AI
coding agent** (Claude Code, Cursor, Codex, Windsurf, or any MCP-compatible agent). It has two forms:

- **The client** — an open-source MCP server you run on your own machine (`npx capx-cafe`). It holds **no X
  credentials** — only a short-lived session handle.
- **The hosted chokepoint** — a server operated by capx that holds your X access token in an encrypted
  vault, runs a guardrail ("casserole") on every post, and is the **only** path from the tool to X.

**capx does not write your content.** Your AI agent (driven by a model you chose — Claude, GPT, Gemini,
etc.) drafts the text; capx transports it to X after the guardrail passes. capx runs no AI model that
generates posts, images, or video. Media you attach comes from **your own** media-generation tools that
**you** connect to **your** agent; capx only uploads and attaches the asset you provide.

capx is **not** X, is not affiliated with or endorsed by X Corp., and is not a substitute for X's own
terms. Your use of X remains governed by X's Terms of Service, Developer Agreement & Policy, and Automation
Rules.

## 2. Eligibility, alpha status, and the whitelist

- capx is currently offered as a **private alpha** to whitelisted users only. Access can be granted or
  revoked at our discretion.
- You must be at least **18** years old and legally able to enter this agreement.
- **Alpha software is provided "as is."** Features may change or break; data models may change; the service
  may be suspended. Do not rely on it for business-critical posting without your own backups/checks.

## 3. The two lanes

1. **BYO lane** — you bring your **own** X developer app (your client ID). You are X's customer; **you** pay
   X and are bound by X's developer terms directly. capx transports your posts; it does not pay X on your
   behalf.
2. **capx-app lane** (creator lane) — you post through **capx's** X application. capx pays X's API cost and
   therefore **meters and caps** your usage. Abuse of this shared application (see §5) can be rate-limited,
   capped, or cut off to protect every other user of the shared app.

[CONFIRM: pricing terms for the capx-app lane once monetization (P4) ships — billing cadence, refunds,
what a cancellation does to scheduled posts.]

## 4. Your X credentials and the guardrail

- When you connect X, the OAuth flow completes on capx's hosted callback and your **access/refresh tokens
  are stored encrypted in capx's vault**. They are never written to your machine and never returned to your
  agent. See the Privacy Policy for exactly what we hold and what we can and cannot see.
- **Every post passes casserole**, a deterministic (non-AI) guardrail, before it can reach X. casserole may
  **pass, ask your agent to rewrite, hold for human review, or block** a post. A blocked post never causes
  your token to be decrypted. **casserole is a safety limit, not a guarantee** — it reduces the risk of bad
  posts; it does not promise that every post is compliant, accurate, or appropriate. You remain responsible
  for what is posted from your account (§5).
- **Media is not moderated.** casserole guards the **caption text** only. Any image or video you attach is
  uploaded **without content inspection** — you are solely responsible for it, including setting the AI-content
  label where X policy requires it. (Your agent/skill sets that label; capx carries it to X.)

## 5. Acceptable use — your responsibilities

You agree not to use capx to:

- violate X's Terms, Developer Policy, or **Automation Rules** (including rules on automated posting,
  spam, and duplicative content);
- post spam, malware, scams, harassment, hate, illegal content, or content infringing others' rights;
- impersonate any person or entity, or misrepresent AI-generated media (label it as X requires);
- exceed, evade, or attempt to bypass rate limits, caps, the guardrail, or the kill-switch;
- attempt to extract another user's tokens or data, or attack the service.

**You are responsible for every post made from your connected account**, whether you, your agent, or a
schedule triggered it. Automating posting does not transfer that responsibility to capx.

## 6. Suspension and the kill-switch

We may **immediately** pause, cap, or disconnect any account — via a per-handle kill-switch or allowlist
removal — where we reasonably believe it is abusing the service, endangering the shared X application,
violating these terms or X's rules, or on X's or a legal authority's request. We will make reasonable effort
to tell you why, but protecting the shared service and other users comes first.

## 7. Self-hosting

capx's chokepoint is open source (AGPL-3.0). You may run your own instance with your own X app, keys,
database, and domain. **If you self-host, you are the operator**: you are responsible for your instance's
security, compliance, guardrail configuration, and users. capx provides no warranty or support for
self-hosted instances and receives no data from them. If you modify and run it as a network service, the
AGPL-3.0 obligations (including offering your modified source) apply to you.

## 8. Open-source license

The client and shared libraries are **MIT-licensed**; the chokepoint and its server-only packages are
**AGPL-3.0-licensed**. These Terms govern your use of the **hosted service**; the software licenses govern
your use of the **code**. Where they overlap, the applicable open-source license controls for the code
itself. Contributions are accepted under the project CLA.

## 9. Intellectual property; your content

- You retain all rights to the content you create and post. You grant capx only the limited, temporary
  rights needed to transport, guard, schedule, and deliver that content to X on your instruction, and to
  keep an audit record of what was posted and why the guardrail passed or blocked it.
- "capx", "capx café", and related marks are trademarks of capx [CONFIRM: registration status/number]. The
  open-source license does not grant trademark rights.

## 10. Disclaimers and limitation of liability

- The service is provided **"as is" and "as available," without warranties** of any kind, to the maximum
  extent permitted by law. We do not warrant that posting will always succeed, that scheduled posts will
  fire, that the guardrail will catch every problem, or that the service will be uninterrupted.
- **We are not liable** for indirect, incidental, special, consequential, or punitive damages, or for lost
  profits, lost data, account suspension **by X**, or third-party actions. Our aggregate liability is capped
  at [CONFIRM: liability cap — e.g. fees paid in the prior 12 months, or a fixed sum]. Some jurisdictions do
  not allow these limits; where they don't, they apply to the extent permitted.
- capx is not responsible for the behavior, cost, output, or terms of **your own** media-generation tools
  or any third-party MCP servers you connect.

## 11. Termination

You may stop using capx and disconnect X at any time; disconnection revokes capx's access and deletes your
stored tokens within 30 days. We may suspend or terminate access per §6 or on 30 days' notice for any reason
during alpha.

## 12. Changes

We may update these Terms; material changes will be notified by email or in-product. Continued use after
changes take effect means acceptance.

## 13. Governing law and disputes

These Terms are governed by the laws of [CONFIRM: governing law jurisdiction], and the courts of
[CONFIRM: venue] have exclusive jurisdiction, subject to any mandatory consumer-protection rights in your
place of residence.

---

_Companion: `PRIVACY-POLICY.md`. This document tracks the locked decisions in STATE §5; if those change,
revisit §3, §4, and §7._
