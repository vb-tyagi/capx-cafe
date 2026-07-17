// PostgresStore — the production driver implementing EVERY chokepoint port over one Postgres, behind
// the same interfaces InMemoryStore does (so nothing above the port changes). Depends only on a minimal
// SqlPool shape, so it runs against the real `pg` Pool AND pg-mem (offline tests). jsonb columns carry
// SealedToken / resolved-tokens; bigint columns are read through Number() so a driver returning them as
// strings (real pg default) or numbers (pg-mem) both work.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Lane, AccountStanding, OutboxJob, OutboxState, PostHistoryItem } from '@capx/core';
import type { VaultStore, VaultRow } from '../vault/index.ts';
import type { SealedToken } from '../vault/crypto.ts';
import type { AdmissionStore } from '../admission/index.ts';
import type { OutboxStore } from '../outbox/index.ts';
import type { PendingStore, PendingConnection, ResolvedConnection } from '../oauth/index.ts';
import type { MeteringStore } from '../metering/index.ts';
import type { RecentPostStore } from '../recent/index.ts';

/** Minimal pool shape satisfied by both the real `pg` Pool and pg-mem's adapter. */
export interface SqlPool {
  query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

/** Tolerant jsonb read: real pg returns a parsed object; a stringified value is JSON.parsed. */
function asJson<T>(v: unknown): T {
  return typeof v === 'string' ? (JSON.parse(v) as T) : (v as T);
}

export async function runMigrations(pool: SqlPool): Promise<void> {
  const raw = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../migrations/001_init.sql'), 'utf8');
  // Strip `--` line comments BEFORE splitting on ';' — comments may themselves contain semicolons.
  const sql = raw.replace(/--[^\n]*/g, '');
  for (const stmt of sql.split(';')) {
    const s = stmt.trim();
    if (s) await pool.query(s);
  }
}

export class PostgresStore
  implements VaultStore, AdmissionStore, OutboxStore, PendingStore, MeteringStore, RecentPostStore
{
  readonly #pool: SqlPool;

  constructor(pool: SqlPool) {
    this.#pool = pool;
  }

  // ---- VaultStore ----
  async put(row: VaultRow): Promise<void> {
    await this.#pool.query(
      `insert into vault (vault_ref,email_hash,x_user_id,username,lane,standing,access,refresh,refresh_rotated_at,needs_reauth,verified,created_at_ms)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (vault_ref) do update set
         access=excluded.access, refresh=excluded.refresh,
         refresh_rotated_at=excluded.refresh_rotated_at, needs_reauth=excluded.needs_reauth,
         verified=excluded.verified, created_at_ms=excluded.created_at_ms`,
      [row.vaultRef, row.emailHash, row.xUserId, row.username, row.lane, row.standing, row.access, row.refresh, row.refreshRotatedAt, row.needsReauth, row.verified, row.createdAtMs],
    );
  }
  async getByRef(vaultRef: string): Promise<VaultRow | null> {
    const { rows } = await this.#pool.query(`select * from vault where vault_ref=$1`, [vaultRef]);
    return rows[0] ? this.#toVaultRow(rows[0]) : null;
  }
  async getByEmailHash(emailHash: string): Promise<VaultRow | null> {
    const { rows } = await this.#pool.query(`select * from vault where email_hash=$1 order by refresh_rotated_at desc limit 1`, [emailHash]);
    return rows[0] ? this.#toVaultRow(rows[0]) : null;
  }
  async updateTokens(vaultRef: string, access: SealedToken, refresh: SealedToken, rotatedAt: number): Promise<void> {
    await this.#pool.query(`update vault set access=$2, refresh=$3, refresh_rotated_at=$4 where vault_ref=$1`, [vaultRef, access, refresh, rotatedAt]);
  }
  async markNeedsReauth(vaultRef: string): Promise<void> {
    await this.#pool.query(`update vault set needs_reauth=true where vault_ref=$1`, [vaultRef]);
  }
  #toVaultRow(r: Record<string, unknown>): VaultRow {
    return {
      vaultRef: String(r.vault_ref),
      emailHash: String(r.email_hash),
      xUserId: String(r.x_user_id),
      username: String(r.username),
      lane: r.lane as Lane,
      standing: r.standing as AccountStanding,
      access: asJson<SealedToken>(r.access),
      refresh: asJson<SealedToken>(r.refresh),
      refreshRotatedAt: Number(r.refresh_rotated_at),
      needsReauth: Boolean(r.needs_reauth),
      verified: Boolean(r.verified),
      createdAtMs: Number(r.created_at_ms),
    };
  }

  // ---- AdmissionStore ----
  async isAllowlisted(emailHash: string): Promise<boolean> {
    const { rows } = await this.#pool.query(`select 1 from allowlist where email_hash=$1`, [emailHash]);
    return rows.length > 0;
  }
  async addAllowlisted(emailHash: string): Promise<void> {
    await this.#pool.query(`insert into allowlist (email_hash) values ($1) on conflict (email_hash) do nothing`, [emailHash]);
  }
  async isGlobalKill(): Promise<boolean> {
    const { rows } = await this.#pool.query(`select killed from kill_global where singleton=true`);
    return rows[0] ? Boolean(rows[0].killed) : false;
  }
  async isHandleKill(key: string): Promise<boolean> {
    const { rows } = await this.#pool.query(`select 1 from kill_handles where handle_key=$1`, [key]);
    return rows.length > 0;
  }
  async setGlobalKill(on: boolean): Promise<void> {
    await this.#pool.query(`update kill_global set killed=$1 where singleton=true`, [on]);
  }
  async setHandleKill(key: string, on: boolean): Promise<void> {
    if (on) await this.#pool.query(`insert into kill_handles (handle_key) values ($1) on conflict (handle_key) do nothing`, [key]);
    else await this.#pool.query(`delete from kill_handles where handle_key=$1`, [key]);
  }

  // ---- OutboxStore ----
  async findByIdempotencyKey(key: string): Promise<OutboxJob | null> {
    const { rows } = await this.#pool.query(`select * from outbox where idempotency_key=$1`, [key]);
    return rows[0] ? this.#toOutboxJob(rows[0]) : null;
  }
  async insert(job: OutboxJob): Promise<void> {
    await this.#pool.query(
      `insert into outbox (id,idempotency_key,email_hash,vault_ref,body,ai_generated,lane,state,scheduled_at_ms,created_at_ms)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [job.id, job.idempotencyKey, job.emailHash, job.vaultRef, job.text, job.aiGenerated, job.lane, job.state, job.scheduledAtMs, job.createdAtMs],
    );
  }
  async setState(id: string, state: OutboxState): Promise<void> {
    await this.#pool.query(`update outbox set state=$2 where id=$1`, [id, state]);
  }
  #toOutboxJob(r: Record<string, unknown>): OutboxJob {
    return {
      id: String(r.id),
      idempotencyKey: String(r.idempotency_key),
      emailHash: String(r.email_hash),
      vaultRef: String(r.vault_ref),
      text: String(r.body),
      aiGenerated: Boolean(r.ai_generated),
      lane: r.lane as Lane,
      state: r.state as OutboxState,
      scheduledAtMs: Number(r.scheduled_at_ms),
      createdAtMs: Number(r.created_at_ms),
    };
  }

  // ---- PendingStore ----
  async putPending(p: PendingConnection): Promise<void> {
    await this.#pool.query(
      `insert into oauth_pending (pending_id,verifier,email_hash,lane,client_id,session_nonce,created_at,expires_at,resolved)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (pending_id) do update set resolved=excluded.resolved`,
      [p.pendingId, p.verifier, p.emailHash, p.lane, p.clientId, p.sessionNonce, p.createdAt, p.expiresAt, p.resolved],
    );
  }
  async getPending(pendingId: string): Promise<PendingConnection | null> {
    const { rows } = await this.#pool.query(`select * from oauth_pending where pending_id=$1`, [pendingId]);
    const r = rows[0];
    if (!r) return null;
    return {
      pendingId: String(r.pending_id),
      verifier: String(r.verifier),
      emailHash: String(r.email_hash),
      lane: r.lane as Lane,
      clientId: String(r.client_id),
      sessionNonce: String(r.session_nonce),
      createdAt: Number(r.created_at),
      expiresAt: Number(r.expires_at),
      resolved: r.resolved == null ? null : asJson<ResolvedConnection>(r.resolved),
    };
  }
  async deletePending(pendingId: string): Promise<void> {
    await this.#pool.query(`delete from oauth_pending where pending_id=$1`, [pendingId]);
  }

  // ---- MeteringStore ----
  async postsToday(emailHash: string, dayIndex: number): Promise<number> {
    const { rows } = await this.#pool.query(`select count from metering where email_hash=$1 and day_index=$2`, [emailHash, dayIndex]);
    return rows[0] ? Number(rows[0].count) : 0;
  }
  async recordPost(emailHash: string, dayIndex: number): Promise<void> {
    await this.#pool.query(
      `insert into metering (email_hash,day_index,count) values ($1,$2,1)
       on conflict (email_hash,day_index) do update set count = metering.count + 1`,
      [emailHash, dayIndex],
    );
  }

  // ---- RecentPostStore ----
  async recentPosts(emailHash: string, sinceMs: number): Promise<PostHistoryItem[]> {
    const { rows } = await this.#pool.query(
      `select body, posted_at, loop_id from recent_posts where email_hash=$1 and posted_at>=$2 order by posted_at`,
      [emailHash, sinceMs],
    );
    return rows.map((r) => ({ text: String(r.body), postedAt: Number(r.posted_at), loopId: r.loop_id == null ? undefined : String(r.loop_id) }));
  }
  async recordRecentPost(emailHash: string, item: PostHistoryItem): Promise<void> {
    await this.#pool.query(`insert into recent_posts (email_hash,body,posted_at,loop_id) values ($1,$2,$3,$4)`, [emailHash, item.text, item.postedAt, item.loopId ?? null]);
  }
}
