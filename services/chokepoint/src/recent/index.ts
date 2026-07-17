// Per-handle recent-post cache. Written on a CONFIRMED send, read into ctx.history at the gate so
// casserole L2 (daily ceiling) + L3 (near-duplicate dedup) actually enforce on real history — the
// piece that makes the per-handle mutex meaningful (read-history -> gauntlet -> send -> write-cache is
// one critical section, so two concurrent post_now for a handle can't both pass on a stale history).
import type { PostHistoryItem } from '@capx-cafe/core';

export interface RecentPostStore {
  recentPosts(emailHash: string, sinceMs: number): Promise<PostHistoryItem[]>;
  recordRecentPost(emailHash: string, item: PostHistoryItem): Promise<void>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class RecentPosts {
  readonly #store: RecentPostStore;
  readonly #windowMs: number;

  constructor(store: RecentPostStore, windowMs: number = DAY_MS) {
    this.#store = store;
    this.#windowMs = windowMs;
  }

  recent(emailHash: string, now: number): Promise<PostHistoryItem[]> {
    return this.#store.recentPosts(emailHash, now - this.#windowMs);
  }

  record(emailHash: string, item: PostHistoryItem): Promise<void> {
    return this.#store.recordRecentPost(emailHash, item);
  }
}
