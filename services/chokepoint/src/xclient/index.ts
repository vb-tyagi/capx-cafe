// The vault-backed X adapter — the real PlatformClient that replaces FakePlatformClient in prod.
// channelId is the vaultRef; the adapter resolves it to the plaintext access token ONLY inside
// vault.withToken() (the single plaintext boundary), calls X, and returns the tweet id. The token
// never returns to the gate or any caller. The actual HTTP call is injected (XPoster) so the adapter
// and the gate stay unit-testable with no network.
import type { PlatformClient, PublishRequest, PublishResult } from '@capx-cafe/platform-client';
import type { Vault } from '../vault/index.ts';

export type XPoster = (input: { accessToken: string; text: string; inReplyToId?: string; mediaIds?: string[] }) => Promise<{ id: string }>;

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
      this.#post({ accessToken, text: req.text, inReplyToId: req.inReplyToId, mediaIds: req.mediaIds }),
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
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<MinimalResponse>;

/**
 * A non-2xx from X, carrying the HTTP status + response body so a caller can act on it. The publish gate
 * inspects `status === 401` to tell an expired/invalid access token (refresh-and-retry) from any other
 * failure (fail the send). The body is X's own error text — NOT a secret — and is surfaced for debugging.
 */
export class XApiError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string, message: string) {
    super(message);
    this.name = 'XApiError';
    this.status = status;
    this.body = body;
  }
}

/** True iff the error is X rejecting the access token as unauthorized (HTTP 401) — the refresh trigger. */
export function isXAuthError(e: unknown): boolean {
  return e instanceof XApiError && e.status === 401;
}

export function httpXPoster(fetchImpl: FetchLike, endpoint = 'https://api.twitter.com/2/tweets'): XPoster {
  return async ({ accessToken, text, inReplyToId, mediaIds }) => {
    const payload: Record<string, unknown> = { text };
    // X threads a post by nesting the parent id under `reply.in_reply_to_tweet_id`.
    if (inReplyToId) payload.reply = { in_reply_to_tweet_id: inReplyToId };
    // Attach already-uploaded media (Phase 4). X takes the ids under `media.media_ids`. casserole never
    // inspected these — only the caption `text` was guarded upstream.
    if (mediaIds && mediaIds.length) payload.media = { media_ids: mediaIds };
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // Throw a typed error (not a bare Error) so the gate can distinguish a 401 (expired token — X access
    // tokens die ~2h after connect) and refresh-then-retry, instead of failing every aged-out post.
    if (!res.ok) {
      const body = await res.text();
      throw new XApiError(res.status, body, `X /2/tweets failed: ${res.status} ${body}`);
    }
    const data = (await res.json()) as { data?: { id?: string } };
    const id = data.data?.id;
    if (!id) throw new Error('X /2/tweets: missing tweet id in response');
    return { id };
  };
}

// --- Media upload (Phase 4). Chunked INIT -> APPEND -> FINALIZE -> STATUS-poll (video/gif). The bytes ---
// reach here from the MCP (which read the user's local asset); casserole never inspected them. The token
// is supplied by the gateway inside vault.withToken, so — like the poster — this never sees a raw token
// except through the injected fetch. Behind the same FetchLike so it unit-tests with no network.

export type XMediaUploader = (input: {
  accessToken: string;
  bytes: Uint8Array;
  mediaType: string; // e.g. image/png, image/jpeg, image/gif, video/mp4
  category: string; // X media_category: tweet_image | tweet_gif | tweet_video
}) => Promise<{ mediaId: string }>;

export interface XMediaUploaderOptions {
  endpoint?: string;
  /** raw bytes per APPEND chunk (X caps a chunk at 5 MB; default 4 MB leaves base64 headroom). */
  chunkBytes?: number;
  /** injected so STATUS polling is deterministic in tests. */
  sleep?: (ms: number) => Promise<void>;
  /** cap on STATUS polls so a stuck 'in_progress' can't loop forever. */
  maxStatusPolls?: number;
}

interface MediaInitResponse {
  media_id_string?: string;
  processing_info?: { state: string; check_after_secs?: number };
}

export function httpXMediaUploader(fetchImpl: FetchLike, opts: XMediaUploaderOptions = {}): XMediaUploader {
  const endpoint = opts.endpoint ?? 'https://upload.twitter.com/1.1/media/upload.json';
  const chunkBytes = opts.chunkBytes ?? 4_000_000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const maxPolls = opts.maxStatusPolls ?? 20;

  return async ({ accessToken, bytes, mediaType, category }) => {
    const headers = { authorization: `Bearer ${accessToken}`, 'content-type': 'application/x-www-form-urlencoded' };
    const form = (params: Record<string, string>): string => new URLSearchParams(params).toString();

    // INIT — declare the upload; X returns the media id we then append chunks to.
    const initRes = await fetchImpl(endpoint, {
      method: 'POST',
      headers,
      body: form({ command: 'INIT', total_bytes: String(bytes.length), media_type: mediaType, media_category: category }),
    });
    if (!initRes.ok) throw new Error(`X media INIT failed: ${initRes.status} ${await initRes.text()}`);
    const init = (await initRes.json()) as MediaInitResponse;
    const mediaId = init.media_id_string;
    if (!mediaId) throw new Error('X media INIT: missing media_id_string');

    // APPEND — stream the bytes in base64 chunks, in order.
    let segment = 0;
    for (let off = 0; off < bytes.length; off += chunkBytes) {
      const chunk = bytes.subarray(off, Math.min(off + chunkBytes, bytes.length));
      const mediaData = Buffer.from(chunk).toString('base64');
      const apRes = await fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body: form({ command: 'APPEND', media_id: mediaId, segment_index: String(segment), media_data: mediaData }),
      });
      if (!apRes.ok) throw new Error(`X media APPEND ${segment} failed: ${apRes.status} ${await apRes.text()}`);
      segment += 1;
    }

    // FINALIZE — X assembles the media; for video/gif it returns processing_info we must poll.
    const finRes = await fetchImpl(endpoint, { method: 'POST', headers, body: form({ command: 'FINALIZE', media_id: mediaId }) });
    if (!finRes.ok) throw new Error(`X media FINALIZE failed: ${finRes.status} ${await finRes.text()}`);
    let info = ((await finRes.json()) as MediaInitResponse).processing_info;

    let polls = 0;
    while (info && (info.state === 'pending' || info.state === 'in_progress')) {
      if (polls >= maxPolls) throw new Error('X media processing did not finish in time');
      await sleep(Math.max(1, info.check_after_secs ?? 1) * 1000);
      const stRes = await fetchImpl(`${endpoint}?command=STATUS&media_id=${mediaId}`, { method: 'GET', headers });
      if (!stRes.ok) throw new Error(`X media STATUS failed: ${stRes.status} ${await stRes.text()}`);
      info = ((await stRes.json()) as MediaInitResponse).processing_info;
      polls += 1;
    }
    if (info && info.state === 'failed') throw new Error('X media processing failed');

    return { mediaId };
  };
}
