// Tool orchestration for the agent-co-resident MCP server. Each tool is a thin authenticated call to
// the chokepoint; the MCP holds only a short-TTL session bearer (lazily obtained/refreshed) and the
// transient connect pending-ref. It renders the chokepoint's verdict so the agent can explain a
// blocked/held post WITHOUT re-running or being able to skip the guard (assume-compromised posture).
import type { ChokepointClient, PostResp } from './client.ts';

export interface McpConfig {
  emailHash: string;
  lane: 'byo' | 'capx-app';
  clientId?: string;
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
    if (lane === 'byo' && !clientId) {
      return {
        text: 'BYO lane needs your X app Client ID. Set X_CLIENT_ID (or pass clientId) and retry.',
        data: { connected: false, needsClientId: true },
      };
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

  async postNow(args: { text: string; aiGenerated?: boolean; idempotencyKey?: string }): Promise<ToolResult> {
    const bearer = await this.#ensureSession();
    // A stable idempotency key so a retried tool call can't double-post (chokepoint dedups on it).
    const key = args.idempotencyKey ?? `${this.#cfg.emailHash}:${this.#now()}:${args.text.length}`;
    const r = await this.#client.postNow(bearer, { text: args.text, aiGenerated: args.aiGenerated ?? false, idempotencyKey: key });
    return { text: renderOutcome(r), data: { ...r } };
  }
}
