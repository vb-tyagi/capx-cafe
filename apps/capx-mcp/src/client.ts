// Typed HTTP client for services/chokepoint. The MCP server's ENTIRE capability is "call the gated
// chokepoint with a revocable session handle" — this is that call surface. fetch is injected so the
// client (and the tools above it) unit-test with no network; prod passes a global-fetch wrapper.
export interface HttpResponse {
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
  text(): Promise<string>;
}
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<HttpResponse>;

export interface SessionResp {
  bearer: string;
}
export interface StartResp {
  consentUrl: string;
  pendingId: string;
  sessionNonce: string;
  expiresAt: number;
}
export interface ConfirmResp {
  connected: boolean;
  username: string;
}
export interface WhoamiResp {
  connected: boolean;
  username?: string;
  lane?: string;
  needsReauth?: boolean;
}
export interface PostResp {
  outcome: string;
  verdict?: string;
  requiresHumanReview?: boolean;
  finalReasons: string[];
  platformPostId?: string;
}
export interface PreviewResp {
  verdict: string;
  requiresHumanReview: boolean;
  finalReasons: string[];
  wouldSend: boolean;
  rejected?: string;
}
export interface AuditEntryResp {
  idempotencyKey: string;
  text: string;
  state: string;
  aiGenerated: boolean;
  lane: string;
  scheduledAtMs: number;
  createdAtMs: number;
}
export interface AuditResp {
  entries: AuditEntryResp[];
  rejected?: string;
}
export interface LoopResp {
  id: string;
  timezone: string;
  timeOfDayMinutes: number;
  daysOfWeek: number[];
  buffer: string[];
  paused: boolean;
  pausedReason?: string;
  lastFiredDayKey?: string;
  aiGenerated?: boolean;
}
export interface CreateLoopBody {
  timezone: string;
  timeOfDayMinutes: number;
  daysOfWeek: number[];
  posts: string[];
  aiGenerated?: boolean;
}

export class ChokepointClient {
  readonly #base: string;
  readonly #fetch: FetchLike;

  constructor(baseUrl: string, fetchImpl: FetchLike) {
    this.#base = baseUrl.replace(/\/$/, '');
    this.#fetch = fetchImpl;
  }

  async #post<T>(path: string, body: unknown, bearer?: string): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (bearer) headers.authorization = `Bearer ${bearer}`;
    const res = await this.#fetch(`${this.#base}${path}`, { method: 'POST', headers, body: JSON.stringify(body ?? {}) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error(`chokepoint ${path} ${res.status}: ${String(data.error ?? 'request failed')}`);
    return data as T;
  }

  session(emailHash: string): Promise<SessionResp> {
    return this.#post<SessionResp>('/session', { emailHash });
  }
  startConnect(bearer: string, input: { lane: string; clientId?: string }): Promise<StartResp> {
    return this.#post<StartResp>('/oauth/start', input, bearer);
  }
  confirm(bearer: string, input: { pendingId: string; sessionNonce: string }): Promise<ConfirmResp> {
    return this.#post<ConfirmResp>('/oauth/confirm', input, bearer);
  }
  whoami(bearer: string): Promise<WhoamiResp> {
    return this.#post<WhoamiResp>('/whoami', {}, bearer);
  }
  postNow(bearer: string, input: { text: string; aiGenerated: boolean; idempotencyKey: string; inReplyToId?: string }): Promise<PostResp> {
    return this.#post<PostResp>('/post_now', input, bearer);
  }
  preview(bearer: string, input: { text: string; aiGenerated: boolean }): Promise<PreviewResp> {
    return this.#post<PreviewResp>('/preview', input, bearer);
  }
  audit(bearer: string, limit?: number): Promise<AuditResp> {
    return this.#post<AuditResp>('/audit', { limit }, bearer);
  }

  // ---- Loops ----
  createLoop(bearer: string, input: CreateLoopBody): Promise<{ loop: LoopResp }> {
    return this.#post<{ loop: LoopResp }>('/loops/create', input, bearer);
  }
  listLoops(bearer: string): Promise<{ loops: LoopResp[] }> {
    return this.#post<{ loops: LoopResp[] }>('/loops/list', {}, bearer);
  }
  pauseLoop(bearer: string, id: string, paused: boolean): Promise<{ loop: LoopResp }> {
    return this.#post<{ loop: LoopResp }>('/loops/pause', { id, paused }, bearer);
  }
  topUpLoop(bearer: string, id: string, posts: string[]): Promise<{ loop: LoopResp }> {
    return this.#post<{ loop: LoopResp }>('/loops/topup', { id, posts }, bearer);
  }
  deleteLoop(bearer: string, id: string): Promise<{ ok: boolean }> {
    return this.#post<{ ok: boolean }>('/loops/delete', { id }, bearer);
  }
}
