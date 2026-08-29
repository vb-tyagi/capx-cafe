// In-memory Store — the DEFAULT driver for tests + local dev, implementing every port (vault,
// admission, outbox). The PostgresStore (the real "one Postgres" of §1) implements the SAME ports at
// S3/S4; nothing above the port cares which is wired. This is why `pnpm verify` needs no database.
import type { VaultStore, VaultRow } from '../vault/index.ts';
import type { SealedToken } from '../vault/crypto.ts';
import type { AdmissionStore } from '../admission/index.ts';
import type { OutboxStore } from '../outbox/index.ts';
import type { PendingStore, PendingConnection } from '../oauth/index.ts';
import type { MeteringStore } from '../metering/index.ts';
import type { PlanUsageStore, ThreadNode } from '../metering/plans.ts';
import type { RecentPostStore } from '../recent/index.ts';
import type { LoopStore, LoopRecord } from '../loops/index.ts';
import { OutboxState } from '@capx-cafe/core';
import type { OutboxJob, PostHistoryItem } from '@capx-cafe/core';
import type { QuotaCategory } from '@capx-cafe/counter';

export class InMemoryStore
  implements VaultStore, AdmissionStore, OutboxStore, PendingStore, MeteringStore, PlanUsageStore, RecentPostStore, LoopStore
{
  // vault
  readonly #vault = new Map<string, VaultRow>(); // vaultRef -> row
  readonly #vaultByEmail = new Map<string, string>(); // emailHash -> vaultRef
  // admission
  readonly #allowlist = new Set<string>();
  #killGlobal = false;
  readonly #killHandles = new Set<string>();
  // outbox
  readonly #outbox = new Map<string, OutboxJob>(); // id -> job
  readonly #outboxByIdem = new Map<string, string>(); // idempotencyKey -> id
  // oauth pending
  readonly #pending = new Map<string, PendingConnection>(); // pendingId(state) -> pending
  // metering (lane B): posts per emailHash per day
  readonly #metering = new Map<string, number>(); // `${emailHash}:${dayIndex}` -> count
  // plan metering v2: per-cycle usage + pack balances + the thread index + per-user plan assignment
  readonly #planUsage = new Map<string, number>(); // `${emailHash}:${cycle}:${category}` -> used
  readonly #packBalance = new Map<string, number>(); // `${emailHash}:${cycle}:${category}` -> remaining
  readonly #threadIndex = new Map<string, ThreadNode>(); // `${emailHash}:${platformPostId}` -> node
  readonly #userPlans = new Map<string, string>(); // emailHash -> plan id
  // recent-post cache: per-handle post history for casserole L2/L3
  readonly #recent = new Map<string, PostHistoryItem[]>(); // emailHash -> items
  // loops (scheduled posting)
  readonly #loops = new Map<string, LoopRecord>(); // loop id -> loop

  // ---- VaultStore ----
  async put(row: VaultRow): Promise<void> {
    this.#vault.set(row.vaultRef, row);
    this.#vaultByEmail.set(row.emailHash, row.vaultRef);
  }
  async getByRef(vaultRef: string): Promise<VaultRow | null> {
    return this.#vault.get(vaultRef) ?? null;
  }
  async getByEmailHash(emailHash: string): Promise<VaultRow | null> {
    const ref = this.#vaultByEmail.get(emailHash);
    return ref ? (this.#vault.get(ref) ?? null) : null;
  }
  async updateTokens(vaultRef: string, access: SealedToken, refresh: SealedToken, rotatedAt: number): Promise<void> {
    const row = this.#vault.get(vaultRef);
    if (!row) throw new Error(`vault: no row ${vaultRef}`);
    this.#vault.set(vaultRef, { ...row, access, refresh, refreshRotatedAt: rotatedAt });
  }
  async markNeedsReauth(vaultRef: string): Promise<void> {
    const row = this.#vault.get(vaultRef);
    if (!row) throw new Error(`vault: no row ${vaultRef}`);
    this.#vault.set(vaultRef, { ...row, needsReauth: true });
  }

  // ---- AdmissionStore ----
  async isAllowlisted(emailHash: string): Promise<boolean> {
    return this.#allowlist.has(emailHash);
  }
  async addAllowlisted(emailHash: string): Promise<void> {
    this.#allowlist.add(emailHash);
  }
  async isGlobalKill(): Promise<boolean> {
    return this.#killGlobal;
  }
  async isHandleKill(key: string): Promise<boolean> {
    return this.#killHandles.has(key);
  }
  async setGlobalKill(on: boolean): Promise<void> {
    this.#killGlobal = on;
  }
  async setHandleKill(key: string, on: boolean): Promise<void> {
    if (on) this.#killHandles.add(key);
    else this.#killHandles.delete(key);
  }

  // ---- OutboxStore ----
  async findByIdempotencyKey(key: string): Promise<OutboxJob | null> {
    const id = this.#outboxByIdem.get(key);
    return id ? (this.#outbox.get(id) ?? null) : null;
  }
  async insert(job: OutboxJob): Promise<void> {
    this.#outbox.set(job.id, job);
    this.#outboxByIdem.set(job.idempotencyKey, job.id);
  }
  async setState(id: string, state: OutboxState): Promise<void> {
    const job = this.#outbox.get(id);
    if (!job) throw new Error(`outbox: no job ${id}`);
    this.#outbox.set(id, { ...job, state });
  }
  async listByEmailHash(emailHash: string, limit: number): Promise<OutboxJob[]> {
    return [...this.#outbox.values()]
      .filter((j) => j.emailHash === emailHash)
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, limit)
      .map((j) => ({ ...j }));
  }

  // ---- PendingStore ----
  async putPending(p: PendingConnection): Promise<void> {
    this.#pending.set(p.pendingId, p);
  }
  async getPending(pendingId: string): Promise<PendingConnection | null> {
    return this.#pending.get(pendingId) ?? null;
  }
  async deletePending(pendingId: string): Promise<void> {
    this.#pending.delete(pendingId);
  }

  // ---- MeteringStore ----
  async postsToday(emailHash: string, dayIndex: number): Promise<number> {
    return this.#metering.get(`${emailHash}:${dayIndex}`) ?? 0;
  }
  async recordPost(emailHash: string, dayIndex: number): Promise<void> {
    const key = `${emailHash}:${dayIndex}`;
    this.#metering.set(key, (this.#metering.get(key) ?? 0) + 1);
  }

  // ---- PlanUsageStore (plan metering v2) ----
  async getPlanUsage(emailHash: string, cycle: string): Promise<Partial<Record<QuotaCategory, number>> | null> {
    const out: Partial<Record<QuotaCategory, number>> = {};
    for (const c of ['posts', 'urlPosts', 'mediaPosts', 'threads'] as const) {
      const v = this.#planUsage.get(`${emailHash}:${cycle}:${c}`);
      if (v !== undefined) out[c] = v;
    }
    return Object.keys(out).length ? out : null;
  }
  async bumpPlanUsage(emailHash: string, cycle: string, category: QuotaCategory): Promise<void> {
    const key = `${emailHash}:${cycle}:${category}`;
    this.#planUsage.set(key, (this.#planUsage.get(key) ?? 0) + 1);
  }
  async getPackBalances(emailHash: string, cycle: string): Promise<Partial<Record<QuotaCategory, number>> | null> {
    const out: Partial<Record<QuotaCategory, number>> = {};
    for (const c of ['posts', 'urlPosts', 'mediaPosts', 'threads'] as const) {
      const v = this.#packBalance.get(`${emailHash}:${cycle}:${c}`);
      if (v !== undefined) out[c] = v;
    }
    return Object.keys(out).length ? out : null;
  }
  async creditPackBalance(emailHash: string, cycle: string, category: QuotaCategory, units: number): Promise<void> {
    const key = `${emailHash}:${cycle}:${category}`;
    this.#packBalance.set(key, (this.#packBalance.get(key) ?? 0) + units);
  }
  async debitPackBalance(emailHash: string, cycle: string, category: QuotaCategory): Promise<void> {
    const key = `${emailHash}:${cycle}:${category}`;
    const cur = this.#packBalance.get(key) ?? 0;
    if (cur <= 0) throw new Error(`pack balance underflow: ${key}`);
    this.#packBalance.set(key, cur - 1);
  }
  async getThreadNode(emailHash: string, platformPostId: string): Promise<ThreadNode | null> {
    const node = this.#threadIndex.get(`${emailHash}:${platformPostId}`);
    return node ? { ...node } : null;
  }
  async putThreadNode(emailHash: string, platformPostId: string, node: ThreadNode): Promise<void> {
    this.#threadIndex.set(`${emailHash}:${platformPostId}`, { ...node });
  }
  async getUserPlan(emailHash: string): Promise<string | null> {
    return this.#userPlans.get(emailHash) ?? null;
  }
  /** test/admin helper (P4 billing writes plans in prod). */
  async setUserPlan(emailHash: string, plan: string): Promise<void> {
    this.#userPlans.set(emailHash, plan);
  }

  // ---- RecentPostStore ----
  async recentPosts(emailHash: string, sinceMs: number): Promise<PostHistoryItem[]> {
    return (this.#recent.get(emailHash) ?? []).filter((p) => p.postedAt >= sinceMs);
  }
  async recordRecentPost(emailHash: string, item: PostHistoryItem): Promise<void> {
    const list = this.#recent.get(emailHash) ?? [];
    list.push(item);
    this.#recent.set(emailHash, list);
  }

  // ---- LoopStore ----
  // Structured-clone on the way in/out so a caller mutating a returned record can't corrupt the store
  // (the Postgres driver serialises anyway — the in-memory driver must behave identically).
  async createLoop(loop: LoopRecord): Promise<void> {
    this.#loops.set(loop.id, { ...loop, buffer: [...loop.buffer], daysOfWeek: [...loop.daysOfWeek] });
  }
  async getLoop(id: string): Promise<LoopRecord | null> {
    const l = this.#loops.get(id);
    return l ? { ...l, buffer: [...l.buffer], daysOfWeek: [...l.daysOfWeek] } : null;
  }
  async listLoops(emailHash: string): Promise<LoopRecord[]> {
    return [...this.#loops.values()]
      .filter((l) => l.emailHash === emailHash)
      .map((l) => ({ ...l, buffer: [...l.buffer], daysOfWeek: [...l.daysOfWeek] }));
  }
  async listActiveLoops(): Promise<LoopRecord[]> {
    return [...this.#loops.values()]
      .filter((l) => !l.paused)
      .map((l) => ({ ...l, buffer: [...l.buffer], daysOfWeek: [...l.daysOfWeek] }));
  }
  async updateLoop(loop: LoopRecord): Promise<void> {
    this.#loops.set(loop.id, { ...loop, buffer: [...loop.buffer], daysOfWeek: [...loop.daysOfWeek] });
  }
  async deleteLoop(id: string): Promise<void> {
    this.#loops.delete(id);
  }
}
