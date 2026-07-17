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
  postNow(bearer: string, input: { text: string; aiGenerated: boolean; idempotencyKey: string }): Promise<PostResp> {
    return this.#post<PostResp>('/post_now', input, bearer);
  }
}
