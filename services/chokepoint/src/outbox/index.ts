// Durable outbox primitive (pulled forward from S7 into S2 to de-circularize S3/S6 — review fix #2).
// enqueue() is idempotent on idempotencyKey so a retried worker tick cannot double-insert (and, at the
// gate, cannot double-charge). State transitions PENDING -> SENDING -> SENT | PUBLISH_FAILED. The
// Postgres SKIP LOCKED poller + fire-time scheduling land at S7; here it is the in-memory primitive.
import { OutboxState } from '@capx-cafe/core';
import type { OutboxJob } from '@capx-cafe/core';

export interface OutboxStore {
  findByIdempotencyKey(key: string): Promise<OutboxJob | null>;
  insert(job: OutboxJob): Promise<void>;
  setState(id: string, state: OutboxState): Promise<void>;
  /** most-recent-first send history for one handle — the durable source for the audit-trail skill. */
  listByEmailHash(emailHash: string, limit: number): Promise<OutboxJob[]>;
}

export interface EnqueueResult {
  job: OutboxJob;
  deduped: boolean;
}

export class Outbox {
  readonly #store: OutboxStore;

  constructor(store: OutboxStore) {
    this.#store = store;
  }

  /** Look up a job by idempotency key (null if never enqueued). */
  find(idempotencyKey: string): Promise<OutboxJob | null> {
    return this.#store.findByIdempotencyKey(idempotencyKey);
  }

  /** Insert PENDING, or return the existing job if this idempotencyKey was already enqueued. */
  async enqueue(job: OutboxJob): Promise<EnqueueResult> {
    const existing = await this.#store.findByIdempotencyKey(job.idempotencyKey);
    if (existing) return { job: existing, deduped: true };
    await this.#store.insert(job);
    return { job, deduped: false };
  }

  async markSending(id: string): Promise<void> {
    await this.#store.setState(id, OutboxState.SENDING);
  }
  async markSent(id: string): Promise<void> {
    await this.#store.setState(id, OutboxState.SENT);
  }
  async markFailed(id: string): Promise<void> {
    await this.#store.setState(id, OutboxState.PUBLISH_FAILED);
  }

  /** Read the handle's durable send history (most recent first). Powers the audit-trail skill. */
  history(emailHash: string, limit = 50): Promise<OutboxJob[]> {
    return this.#store.listByEmailHash(emailHash, limit);
  }
}
