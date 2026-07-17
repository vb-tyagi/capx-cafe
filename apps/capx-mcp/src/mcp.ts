// Tool orchestration for the agent-co-resident MCP server. Each tool is a thin authenticated call to
// the chokepoint; the MCP holds only a short-TTL session bearer (lazily obtained/refreshed) and the
// transient connect pending-ref. It renders the chokepoint's verdict so the agent can explain a
// blocked/held post WITHOUT re-running or being able to skip the guard (assume-compromised posture).
import type { ChokepointClient, PostResp, LoopResp } from './client.ts';

export interface McpConfig {
  emailHash: string;
  lane: 'byo' | 'capx-app';
  clientId?: string;
  /** the chokepoint's hosted setup guide, surfaced in every BYO failure message. */
  guideUrl?: string;
}

/**
 * Preflight the BYO Client ID BEFORE sending anyone to X. X answers a bad client_id with an opaque
 * error page, so a wrong value costs a confusing round-trip through a browser. Every failure here is
 * one we have actually hit or expect: an unreplaced placeholder, a pasted API Key/Secret, a whole URL.
 * Returns null when it looks usable.
 */
export function preflightClientId(id: string): string | null {
  const v = id.trim();
  if (!v) return 'No X Client ID set. Add X_CLIENT_ID to your capx config.';
  if (/paste|your_|_here|xxx|placeholder/i.test(v)) {
    return `X_CLIENT_ID is still the placeholder ("${v}"). Replace it with your real OAuth 2.0 Client ID.`;
  }
  if (/^https?:\/\//i.test(v)) return 'X_CLIENT_ID looks like a URL. Paste the OAuth 2.0 Client ID, not a link.';
  if (v.includes(' ')) return 'X_CLIENT_ID contains a space — it was probably copied with surrounding text.';
  // X OAuth2 client ids are compact base64url-ish tokens; API keys/secrets are longer or differently shaped.
  if (v.length < 12) return `X_CLIENT_ID looks too short (${v.length} chars). Copy the OAuth 2.0 Client ID from your app's "Keys and tokens" page.`;
  if (v.length > 80) return 'X_CLIENT_ID looks too long — that may be an API Secret or Bearer Token. capx wants the OAuth 2.0 Client ID.';
  if (!/^[A-Za-z0-9_:-]+$/.test(v)) return 'X_CLIENT_ID has unexpected characters — it was probably copied with extra text.';
  return null;
}
export interface ToolResult {
  text: string;
  data: Record<string, unknown>;
}
export interface CapxMcpDeps {
  client: ChokepointClient;
  config: McpConfig;
  now: () => number;
  sessionTtlMs?: number;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function renderLoop(l: LoopResp): string {
  const hh = String(Math.floor(l.timeOfDayMinutes / 60)).padStart(2, '0');
  const mm = String(l.timeOfDayMinutes % 60).padStart(2, '0');
  const days = l.daysOfWeek.map((d) => DAY_NAMES[d] ?? String(d)).join('/');
  const state = l.paused ? ` — PAUSED${l.pausedReason ? ` (${l.pausedReason})` : ''}` : '';
  return `${hh}:${mm} ${l.timezone} on ${days} · ${l.buffer.length} post(s) queued${state} · id ${l.id}`;
}

function renderOutcome(r: PostResp): string {
  const reasons = r.finalReasons.length ? ` Reasons: ${r.finalReasons.join('; ')}` : '';
  switch (r.outcome) {
    case 'published':
      return `Posted to X (id ${r.platformPostId}).`;
    case 'held':
      return `Held for your review — not posted.${reasons}`;
    case 'regenerate':
      return `The guardrail asked for a rewrite — not posted.${reasons}`;
    case 'blocked':
      return `Blocked by the guardrail — not posted.${reasons}`;
    case 'publish_failed':
      return `Passed the guardrail but the X publish failed — not posted.${reasons}`;
    default:
      return `Not posted (${r.outcome}).${reasons}`;
  }
}

export class CapxMcp {
  readonly #client: ChokepointClient;
  readonly #cfg: McpConfig;
  readonly #now: () => number;
  readonly #ttl: number;
  #bearer: string | null = null;
  #bearerExp = 0;
  #pending: { pendingId: string; sessionNonce: string } | null = null;

  constructor(deps: CapxMcpDeps) {
    this.#client = deps.client;
    this.#cfg = deps.config;
    this.#now = deps.now;
    this.#ttl = deps.sessionTtlMs ?? 15 * 60_000;
  }

  async #ensureSession(): Promise<string> {
    // Reuse the bearer until ~30s before expiry, then re-mint (license/allowlist re-checked server-side).
    if (this.#bearer && this.#now() < this.#bearerExp - 30_000) return this.#bearer;
    const { bearer } = await this.#client.session(this.#cfg.emailHash);
    this.#bearer = bearer;
    this.#bearerExp = this.#now() + this.#ttl;
    return bearer;
  }

  /** Two-phase: first call starts consent; call again with { confirm: true } after authorizing. */
  async connectX(args: { confirm?: boolean; lane?: string; clientId?: string } = {}): Promise<ToolResult> {
    const bearer = await this.#ensureSession();

    if (args.confirm) {
      if (!this.#pending) {
        return { text: 'No pending connection. Call connect_x (no args) first, authorize, then confirm.', data: { connected: false } };
      }
      const r = await this.#client.confirm(bearer, this.#pending);
      this.#pending = null;
      return { text: `Connected @${r.username}. You can post_now.`, data: { connected: true, username: r.username } };
    }

    const lane = args.lane ?? this.#cfg.lane;
    const clientId = args.clientId ?? this.#cfg.clientId;
    const guide = this.#cfg.guideUrl ? `\nSetup guide (has your exact callback URL to copy): ${this.#cfg.guideUrl}` : '';
    if (lane === 'byo') {
      // Preflight BEFORE minting a consent URL: X answers a bad client_id with an opaque error, so
      // catching it here saves a confusing trip through the browser.
      const problem = preflightClientId(clientId ?? '');
      if (problem) return { text: `${problem}${guide}`, data: { connected: false, needsClientId: true } };
    }
    const s = await this.#client.startConnect(bearer, { lane: lane === 'capx-app' ? 'CAPX_APP' : 'BYO', clientId });
    this.#pending = { pendingId: s.pendingId, sessionNonce: s.sessionNonce };
    return {
      text: `Open this URL to authorize X, then call connect_x with { confirm: true }:\n${s.consentUrl}`,
      data: { consent_url: s.consentUrl, pending_id: s.pendingId, expires_at: s.expiresAt },
    };
  }

  async whoami(): Promise<ToolResult> {
    const bearer = await this.#ensureSession();
    const w = await this.#client.whoami(bearer);
    if (!w.connected) return { text: 'No X account connected. Run connect_x.', data: { connected: false } };
    const flag = w.needsReauth ? ' (needs re-auth — run connect_x again)' : '';
    return { text: `Connected as @${w.username} on the ${w.lane} lane${flag}.`, data: { ...w } };
  }

  // ---- Loops ----

  /**
   * Parse "09:00" / "9:00" / "0900" into minutes past local midnight. Agents naturally say "9am", not
   * "540", so accept the human form and fail loudly rather than guessing.
   */
  static parseTime(t: string): number | null {
    const m = /^(\d{1,2}):?(\d{2})$/.exec(t.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }

  /** The machine's IANA zone — so "9am" means the user's 9am without them stating it. */
  static localZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }

  async createLoop(args: { time: string; daysOfWeek: number[]; posts: string[]; timezone?: string }): Promise<ToolResult> {
    const bearer = await this.#ensureSession();
    const minutes = CapxMcp.parseTime(args.time);
    if (minutes === null) return { text: `Could not read time "${args.time}". Use HH:MM, e.g. "09:00".`, data: { ok: false } };
    if (!args.posts?.length) {
      return {
        text: 'A loop needs posts you have written — capx never generates content. Write the posts first, then create the loop with them.',
        data: { ok: false, needsPosts: true },
      };
    }
    const timezone = args.timezone ?? CapxMcp.localZone();
    try {
      const { loop } = await this.#client.createLoop(bearer, { timezone, timeOfDayMinutes: minutes, daysOfWeek: args.daysOfWeek, posts: args.posts });
      return { text: `Loop created: ${renderLoop(loop)}`, data: { ok: true, ...loop } };
    } catch (e) {
      return { text: `Could not create the loop: ${e instanceof Error ? e.message : String(e)}`, data: { ok: false } };
    }
  }

  async listLoops(): Promise<ToolResult> {
    const bearer = await this.#ensureSession();
    const { loops } = await this.#client.listLoops(bearer);
    if (!loops.length) return { text: 'No loops yet. Use create_loop with posts you have written.', data: { loops: [] } };
    return { text: loops.map((l) => `• ${renderLoop(l)}`).join('\n'), data: { loops } };
  }

  async pauseLoop(args: { id: string; paused?: boolean }): Promise<ToolResult> {
    const bearer = await this.#ensureSession();
    const paused = args.paused !== false;
    try {
      const { loop } = await this.#client.pauseLoop(bearer, args.id, paused);
      return { text: `Loop ${paused ? 'paused' : 'resumed'}: ${renderLoop(loop)}`, data: { ...loop } };
    } catch (e) {
      return { text: `Could not update that loop: ${e instanceof Error ? e.message : String(e)}`, data: { ok: false } };
    }
  }

  async topUpLoop(args: { id: string; posts: string[] }): Promise<ToolResult> {
    const bearer = await this.#ensureSession();
    if (!args.posts?.length) return { text: 'Write the posts first — capx does not generate them.', data: { ok: false } };
    try {
      const { loop } = await this.#client.topUpLoop(bearer, args.id, args.posts);
      return { text: `Added ${args.posts.length} post(s). ${renderLoop(loop)}`, data: { ...loop } };
    } catch (e) {
      return { text: `Could not top up that loop: ${e instanceof Error ? e.message : String(e)}`, data: { ok: false } };
    }
  }

  async deleteLoop(args: { id: string }): Promise<ToolResult> {
    const bearer = await this.#ensureSession();
    try {
      await this.#client.deleteLoop(bearer, args.id);
      return { text: 'Loop deleted.', data: { ok: true } };
    } catch (e) {
      return { text: `Could not delete that loop: ${e instanceof Error ? e.message : String(e)}`, data: { ok: false } };
    }
  }

  async postNow(args: { text: string; aiGenerated?: boolean; idempotencyKey?: string }): Promise<ToolResult> {
    const bearer = await this.#ensureSession();
    // A stable idempotency key so a retried tool call can't double-post (chokepoint dedups on it).
    const key = args.idempotencyKey ?? `${this.#cfg.emailHash}:${this.#now()}:${args.text.length}`;
    const r = await this.#client.postNow(bearer, { text: args.text, aiGenerated: args.aiGenerated ?? false, idempotencyKey: key });
    return { text: renderOutcome(r), data: { ...r } };
  }
}
