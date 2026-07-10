// The REAL seam to capx-cafe (the open Postiz fork), over HTTP. Boundary-safe: this is CLOSED
// code that *calls* the open fork's API — it never imports fork source. Swaps in for FakePlatformClient.
// The posts path + auth header are configurable so it can target either a thin capx adapter route
// (default `/api/posts`) or Postiz's public API directly (`/public/v1/posts`, raw API-key header).
import type { PlatformClient, PublishRequest, PublishResult } from './index.ts';

interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}
type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<FetchResponseLike>;

export class PlatformError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'PlatformError';
    this.status = status;
  }
}

export interface HttpPlatformClientOptions {
  fetchImpl?: FetchLike;
  /** bearer/HMAC/API-key for the closed↔fork channel */
  serviceToken?: string;
  /** default '/api/posts'; Postiz public API is '/public/v1/posts' */
  postsPath?: string;
  /** default 'authorization' */
  authHeaderName?: string;
  /** default (t) => `Bearer ${t}`; Postiz-style is (t) => t (raw key) */
  authHeaderValue?: (token: string) => string;
}

export class HttpPlatformClient implements PlatformClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly serviceToken?: string;
  private readonly postsPath: string;
  private readonly authHeaderName: string;
  private readonly authHeaderValue: (token: string) => string;

  constructor(baseUrl: string, options: HttpPlatformClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? (globalThis as { fetch: FetchLike }).fetch;
    this.serviceToken = options.serviceToken;
    this.postsPath = options.postsPath ?? '/api/posts';
    this.authHeaderName = options.authHeaderName ?? 'authorization';
    this.authHeaderValue = options.authHeaderValue ?? ((t) => `Bearer ${t}`);
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.serviceToken) headers[this.authHeaderName] = this.authHeaderValue(this.serviceToken);

    const res = await this.fetchImpl(`${this.baseUrl}${this.postsPath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        channelId: req.channelId,
        text: req.text,
        scheduledAt: req.scheduledAtMs,
        aiLabel: req.aiLabel,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new PlatformError(res.status, `capx-cafe publish failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as { id?: string; platformPostId?: string; scheduledAt?: number };
    const id = data.platformPostId ?? data.id;
    if (!id) throw new PlatformError(502, 'capx-cafe returned no post id');
    return { platformPostId: id, scheduledAtMs: data.scheduledAt ?? req.scheduledAtMs };
  }
}
