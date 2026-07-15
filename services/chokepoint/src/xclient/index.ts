// The vault-backed X adapter — the real PlatformClient that replaces FakePlatformClient in prod.
// channelId is the vaultRef; the adapter resolves it to the plaintext access token ONLY inside
// vault.withToken() (the single plaintext boundary), calls X, and returns the tweet id. The token
// never returns to the gate or any caller. The actual HTTP call is injected (XPoster) so the adapter
// and the gate stay unit-testable with no network.
import type { PlatformClient, PublishRequest, PublishResult } from '@capx/platform-client';
import type { Vault } from '../vault/index.ts';

export type XPoster = (input: { accessToken: string; text: string }) => Promise<{ id: string }>;

export interface XAdapterDeps {
  vault: Vault;
  post: XPoster;
}

export class XAdapter implements PlatformClient {
  readonly #vault: Vault;
  readonly #post: XPoster;

  constructor(deps: XAdapterDeps) {
    this.#vault = deps.vault;
    this.#post = deps.post;
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    // withToken decrypts in-memory, hands the token to the closure, and never leaks it outward.
    const { id } = await this.#vault.withToken(req.channelId, async (accessToken) =>
      this.#post({ accessToken, text: req.text }),
    );
    return { platformPostId: id, scheduledAtMs: req.scheduledAtMs };
  }
}

// --- Real HTTP poster (POST /2/tweets), behind an injected fetch so unit tests never hit network ---

export interface MinimalResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<MinimalResponse>;

export function httpXPoster(fetchImpl: FetchLike, endpoint = 'https://api.twitter.com/2/tweets'): XPoster {
  return async ({ accessToken, text }) => {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`X /2/tweets failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { data?: { id?: string } };
    const id = data.data?.id;
    if (!id) throw new Error('X /2/tweets: missing tweet id in response');
    return { id };
  };
}
