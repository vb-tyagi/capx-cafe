// Durable outbox primitive (pulled forward from S7 into S2 to de-circularize S3/S6 — review fix #2).
// enqueue() is idempotent on idempotencyKey so a retried worker tick cannot double-insert (and, at the
// gate, cannot double-charge). State transitions PENDING -> SENDING -> SENT | PUBLISH_FAILED. The
// Postgres SKIP LOCKED poller + fire-time scheduling land at S7; here it is the in-memory primitive.
import { OutboxState } from '@capx/core';
import type { OutboxJob } from '@capx/core';

export interface OutboxStore {
  findByIdempotencyKey(key: string): Promise<OutboxJob | null>;
  insert(job: OutboxJob): Promise<void>;
  setState(id: string, state: OutboxState): Promise<void>;
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
}
