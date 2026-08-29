// Plan metering v2 — the full @capx-cafe/counter plan engine plugged into the P1 seam (as the P1
// comment promised). Quotas are MONTHLY per subscription (shared pool: keyed on emailHash, so every
// handle on the plan draws the same counters), packs are cycle-scoped balances, and the thread index
// records every send's chain position so thread rules stay deterministic with no X reads for our own
// chains. Plan assignment: per-user (written by P4 billing) with a config default for the beta
// whitelist. All decisions are made by the PURE engine in @capx-cafe/counter; this class only moves
// state through the store ports.
import {
  evaluatePost,
  PLANS,
  cycleKey,
  emptyPacks,
  emptyUsage,
  creditPack as engineCreditPack,
} from '@capx-cafe/counter';
import type { Draw, PackBalances, PackType, PlanId, PlanVerdict, PostKind, QuotaCategory, Usage } from '@capx-cafe/counter';

/** One sent post's position in its reply chain (root = depth 1). */
export interface ThreadNode {
  rootId: string;
  depth: number;
}

export interface PlanUsageStore {
  getPlanUsage(emailHash: string, cycle: string): Promise<Partial<Usage> | null>;
  bumpPlanUsage(emailHash: string, cycle: string, category: QuotaCategory): Promise<void>;
  getPackBalances(emailHash: string, cycle: string): Promise<Partial<PackBalances> | null>;
  /** credit is additive (a purchase); debit burns exactly one unit. */
  creditPackBalance(emailHash: string, cycle: string, category: QuotaCategory, units: number): Promise<void>;
  debitPackBalance(emailHash: string, cycle: string, category: QuotaCategory): Promise<void>;
  getThreadNode(emailHash: string, platformPostId: string): Promise<ThreadNode | null>;
  putThreadNode(emailHash: string, platformPostId: string, node: ThreadNode): Promise<void>;
  /** per-user plan assignment (P4 billing writes this); null = not assigned -> config default. */
  getUserPlan(emailHash: string): Promise<string | null>;
}

/** How the gate resolved a reply target before quota evaluation. */
export type ParentResolution =
  | { kind: 'none' }
  | { kind: 'known'; node: ThreadNode }
  | { kind: 'foreign-own' }; // parent not in our index but verified own-authored via X lookup

export interface PlanCheck {
  verdict: PlanVerdict;
  plan: PlanId;
  kind: PostKind;
}

const isPlanId = (v: string | null): v is PlanId => v === 'short' || v === 'tall' || v === 'grande';

export class PlanMetering {
  readonly #store: PlanUsageStore;
  readonly #defaultPlan: PlanId;

  constructor(store: PlanUsageStore, defaultPlan: PlanId) {
    this.#store = store;
    this.#defaultPlan = defaultPlan;
  }

  async plan(emailHash: string): Promise<PlanId> {
    const assigned = await this.#store.getUserPlan(emailHash);
    return isPlanId(assigned) ? assigned : this.#defaultPlan;
  }

  async maxActiveLoops(emailHash: string): Promise<number> {
    return PLANS[await this.plan(emailHash)].maxActiveLoops;
  }

  resolveParent(emailHash: string, platformPostId: string): Promise<ThreadNode | null> {
    return this.#store.getThreadNode(emailHash, platformPostId);
  }

  /** Build the PostKind from what the gate knows. Chain position comes from the resolved parent. */
  static classify(input: { hasLink: boolean; hasMedia: boolean; parent: ParentResolution }): PostKind {
    const { parent } = input;
    if (parent.kind === 'none') return { hasLink: input.hasLink, hasMedia: input.hasMedia, threadRole: 'none' };
    // First reply (parent at depth 1, or an own post made outside capx) STARTS the chain; deeper = continuation.
    const depth = parent.kind === 'known' ? parent.node.depth + 1 : 2;
    return {
      hasLink: input.hasLink,
      hasMedia: input.hasMedia,
      threadRole: depth === 2 ? 'start' : 'continuation',
      threadDepth: depth,
    };
  }

  async check(emailHash: string, kind: PostKind, now: number): Promise<PlanCheck> {
    const plan = await this.plan(emailHash);
    const cycle = cycleKey(now);
    const usage = { ...emptyUsage(), ...(await this.#store.getPlanUsage(emailHash, cycle)) };
    const packs = { ...emptyPacks(), ...(await this.#store.getPackBalances(emailHash, cycle)) };
    return { verdict: evaluatePost(plan, kind, usage, packs), plan, kind };
  }

  /** Apply an allowed verdict's draws after an ACTUAL send. Never called for blocked/held posts. */
  async recordSend(emailHash: string, draws: readonly Draw[], now: number): Promise<void> {
    const cycle = cycleKey(now);
    for (const d of draws) {
      if (d.from === 'quota') await this.#store.bumpPlanUsage(emailHash, cycle, d.category);
      else await this.#store.debitPackBalance(emailHash, cycle, d.category);
    }
  }

  /** Record the sent post's chain position so later replies resolve with zero X reads. */
  async recordThreadNode(emailHash: string, platformPostId: string, parent: ParentResolution, inReplyToId?: string): Promise<void> {
    const node: ThreadNode =
      parent.kind === 'none'
        ? { rootId: platformPostId, depth: 1 }
        : parent.kind === 'known'
          ? { rootId: parent.node.rootId, depth: parent.node.depth + 1 }
          : { rootId: inReplyToId ?? platformPostId, depth: 2 };
    await this.#store.putThreadNode(emailHash, platformPostId, node);
  }

  /** P4 purchase path (and admin backfill): land a bought pack as cycle balance. Validates plan fit. */
  async creditPack(emailHash: string, pack: PackType, quantity: number, now: number): Promise<void> {
    const plan = await this.plan(emailHash);
    // engineCreditPack validates plan availability + quantity and computes the units.
    const credited = engineCreditPack(emptyPacks(), pack, quantity, plan);
    const category = (Object.keys(credited) as QuotaCategory[]).find((c) => credited[c] > 0);
    if (!category) return;
    await this.#store.creditPackBalance(emailHash, cycleKey(now), category, credited[category]);
  }
}
