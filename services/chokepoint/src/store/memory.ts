// In-memory Store — the DEFAULT driver for tests + local dev, implementing every port (vault,
// admission, outbox). The PostgresStore (the real "one Postgres" of §1) implements the SAME ports at
// S3/S4; nothing above the port cares which is wired. This is why `pnpm verify` needs no database.
import type { VaultStore, VaultRow } from '../vault/index.ts';
import type { SealedToken } from '../vault/crypto.ts';
import type { AdmissionStore } from '../admission/index.ts';
import type { OutboxStore } from '../outbox/index.ts';
import type { PendingStore, PendingConnection } from '../oauth/index.ts';
import { OutboxState } from '@capx/core';
import type { OutboxJob } from '@capx/core';

export class InMemoryStore implements VaultStore, AdmissionStore, OutboxStore, PendingStore {
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
}
