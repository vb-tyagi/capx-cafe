// @capx-cafe/counter — creator-lane plan engine (locked 2026-08-29, docs/STATE.md addendum).
// Pure + deterministic: callers supply usage counts, pack balances, and thread depth; this module
// answers "may this post ship, and what does it draw down?". It never talks to a store or clock.
//
// Locked sheet: Short $5 (70 posts, URL posts BANNED, 10 media, no threads, no loops, 1 account) ·
// Tall $15 (200 posts, 25 URL, 10 threads/mo, 30 media, 3 active loops, 2 accounts) · Grande $35
// (500 posts, 50 URL, threads bounded only by the post quota, 100 media, 21 active loops, 5 accounts).
// Quotas are per SUBSCRIPTION (shared pool across its accounts — enforced by keying usage on the
// subscriber, not the handle). Threads are ≤ 10 posts on every plan. Thread posts may not carry URLs.
// Packs top up a single category for the CURRENT cycle only and stack freely; a pack can never unlock
// what a plan structurally bans (Short + URLs/threads).

export const PlanId = { SHORT: 'short', TALL: 'tall', GRANDE: 'grande' } as const;
export type PlanId = (typeof PlanId)[keyof typeof PlanId];

/** One consumable category. Threads meter chain STARTS; posts meter every send. */
export const QuotaCategory = { POSTS: 'posts', URL_POSTS: 'urlPosts', MEDIA_POSTS: 'mediaPosts', THREADS: 'threads' } as const;
export type QuotaCategory = (typeof QuotaCategory)[keyof typeof QuotaCategory];

export interface PlanSpec {
  priceUsd: number;
  /** monthly umbrella quota — every send draws one, whatever else it is. */
  posts: number;
  /** URL-bearing posts allowed per cycle; 0 = structurally banned (no pack unlock). */
  urlPosts: number;
  mediaPosts: number;
  /** thread starts per cycle; Infinity = bounded only by the post quota. 0 = banned. */
  threads: number;
  maxActiveLoops: number;
  maxAccounts: number;
  /** >280-weighted long-form. Structurally impossible today (draft cap), kept for the unlock. */
  allowLongform: boolean;
}

export const PLANS: Record<PlanId, PlanSpec> = {
  short: { priceUsd: 5, posts: 70, urlPosts: 0, mediaPosts: 10, threads: 0, maxActiveLoops: 0, maxAccounts: 1, allowLongform: false },
  tall: { priceUsd: 15, posts: 200, urlPosts: 25, mediaPosts: 30, threads: 10, maxActiveLoops: 3, maxAccounts: 2, allowLongform: true },
  grande: { priceUsd: 35, posts: 500, urlPosts: 50, mediaPosts: 100, threads: Infinity, maxActiveLoops: 21, maxAccounts: 5, allowLongform: true },
};

/** Universal ceiling: a thread is at most this many posts, on every plan. */
export const MAX_THREAD_POSTS = 10;

export const PackType = { POSTS: 'posts', URL: 'url', MEDIA: 'media', THREADS: 'threads' } as const;
export type PackType = (typeof PackType)[keyof typeof PackType];

export interface PackSpec {
  /** units added to the mapped category for the current cycle. */
  size: number;
  priceUsd: number;
  category: QuotaCategory;
  /** plans that may buy it — a pack never unlocks a structural ban. */
  plans: readonly PlanId[];
}

export const PACKS: Record<PackType, PackSpec> = {
  posts: { size: 50, priceUsd: 2, category: 'posts', plans: ['short', 'tall', 'grande'] },
  url: { size: 10, priceUsd: 3, category: 'urlPosts', plans: ['tall', 'grande'] },
  media: { size: 10, priceUsd: 1, category: 'mediaPosts', plans: ['short', 'tall', 'grande'] },
  threads: { size: 10, priceUsd: 1, category: 'threads', plans: ['tall', 'grande'] },
};

/** Per-cycle counters, all starting at 0. Keyed per subscription upstream (shared pool). */
export type Usage = Record<QuotaCategory, number>;
/** Remaining pack units for the current cycle (packs expire with the cycle). */
export type PackBalances = Record<QuotaCategory, number>;

export const emptyUsage = (): Usage => ({ posts: 0, urlPosts: 0, mediaPosts: 0, threads: 0 });
export const emptyPacks = (): PackBalances => ({ posts: 0, urlPosts: 0, mediaPosts: 0, threads: 0 });

/** What the post IS, resolved by the caller (link detection, media ids, thread chain lookup). */
export interface PostKind {
  hasLink: boolean;
  hasMedia: boolean;
  /** 'start' = this send begins a chain (first reply); 'continuation' = deeper reply; 'none' = standalone. */
  threadRole: 'none' | 'start' | 'continuation';
  /** position of THIS post in its chain, 1-based (root = 1). Required when threadRole !== 'none'. */
  threadDepth?: number;
  /** weighted length exceeds the standard cap (future unlock; drafts hard-cap today). */
  longform?: boolean;
}

export interface Draw {
  category: QuotaCategory;
  from: 'quota' | 'pack';
}

export interface PlanVerdict {
  allowed: boolean;
  reasons: string[];
  /** decrements to apply on ACTUAL send (never on a blocked/held post). Empty when !allowed. */
  draws: Draw[];
}

/** Cycle key: UTC calendar month. Beta cycles align to the calendar month; packs expire with it. */
export function cycleKey(nowMs: number): string {
  const d = new Date(nowMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const CATEGORY_LABEL: Record<QuotaCategory, string> = {
  posts: 'post',
  urlPosts: 'link-post',
  mediaPosts: 'media-post',
  threads: 'thread',
};

/**
 * The one decision function. Structural bans first (a pack never unlocks them), then the universal
 * thread ceiling, then per-category quota -> pack draw-down. Worst news wins: any deny is a deny.
 */
export function evaluatePost(plan: PlanId, kind: PostKind, usage: Usage, packs: PackBalances): PlanVerdict {
  const spec = PLANS[plan];
  const reasons: string[] = [];

  // Structural bans — plan-shaped, not quota-shaped.
  if (kind.hasLink && spec.urlPosts === 0) reasons.push(`link posts are not available on the ${plan} plan`);
  if (kind.threadRole !== 'none' && spec.threads === 0) reasons.push(`threads are not available on the ${plan} plan`);
  if (kind.longform && !spec.allowLongform) reasons.push(`long-form posts are not available on the ${plan} plan`);
  // Universal rules — identical on every plan.
  if (kind.threadRole !== 'none') {
    const depth = kind.threadDepth ?? 0;
    if (depth < 1) reasons.push('thread post missing its chain depth');
    else if (depth > MAX_THREAD_POSTS) reasons.push(`a thread is at most ${MAX_THREAD_POSTS} posts (this would be #${depth})`);
    if (kind.hasLink) reasons.push('thread posts may not contain links (on any plan)');
  }
  if (reasons.length) return { allowed: false, reasons, draws: [] };

  // Category draw-down: quota first, then any pack balance for the cycle.
  const touched: QuotaCategory[] = ['posts'];
  if (kind.hasLink) touched.push('urlPosts');
  if (kind.hasMedia) touched.push('mediaPosts');
  if (kind.threadRole === 'start') touched.push('threads');

  const draws: Draw[] = [];
  for (const category of touched) {
    const quota = spec[category === 'urlPosts' ? 'urlPosts' : category === 'mediaPosts' ? 'mediaPosts' : category === 'threads' ? 'threads' : 'posts'];
    if (usage[category] < quota) {
      draws.push({ category, from: 'quota' });
    } else if (packs[category] > 0) {
      draws.push({ category, from: 'pack' });
    } else {
      const label = CATEGORY_LABEL[category];
      const packable = Object.values(PACKS).some((p) => p.category === category && p.plans.includes(plan));
      reasons.push(
        Number.isFinite(quota)
          ? `monthly ${label} quota reached (${usage[category]}/${quota})${packable ? ' — add a top-up pack or upgrade' : ''}`
          : `monthly ${label} allowance exhausted`, // unreachable for Infinity quotas; kept for safety
      );
    }
  }
  if (reasons.length) return { allowed: false, reasons, draws: [] };
  return { allowed: true, reasons: [], draws };
}

/** Apply a verdict's draws after an ACTUAL send: quota draws bump usage, pack draws burn balance. */
export function applyDraws(usage: Usage, packs: PackBalances, draws: readonly Draw[]): { usage: Usage; packs: PackBalances } {
  const u = { ...usage };
  const p = { ...packs };
  for (const d of draws) {
    if (d.from === 'quota') u[d.category] += 1;
    else p[d.category] -= 1;
  }
  return { usage: u, packs: p };
}

/** A purchased pack lands as cycle-scoped balance. quantity = how many packs (they stack freely). */
export function creditPack(packs: PackBalances, pack: PackType, quantity: number, plan: PlanId): PackBalances {
  const spec = PACKS[pack];
  if (!spec.plans.includes(plan)) throw new Error(`${pack} packs are not available on the ${plan} plan`);
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error(`pack quantity must be a positive integer, got ${quantity}`);
  return { ...packs, [spec.category]: packs[spec.category] + spec.size * quantity };
}
