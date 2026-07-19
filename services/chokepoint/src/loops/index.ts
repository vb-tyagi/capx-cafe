// Loops — scheduled posting. THE key constraint (locked 2026-07-17): capx never runs an LLM. At
// create_loop the user's agent writes the posts; a loop is a schedule + a BUFFER of agent-authored text.
// The tick only ever POPS text that already exists. Buffer empty => the loop PAUSES and says so; it does
// not invent content. That is what keeps "the harness writes, casserole decides what ships" true even at
// 9am with the laptop shut.
import { randomUUID } from 'node:crypto';
import type { Autonomy } from '@capx-cafe/core';

export interface LoopRecord {
  id: string;
  emailHash: string;
  /** IANA zone (e.g. 'Asia/Kolkata'), captured from the agent's machine at create. NOT a UTC offset —
   *  offsets break twice a year at DST; an IANA zone keeps "9am" meaning 9am. */
  timezone: string;
  /** minutes past LOCAL midnight in `timezone`. */
  timeOfDayMinutes: number;
  /** 0=Sun..6=Sat, evaluated in `timezone`. */
  daysOfWeek: number[];
  /** agent-authored posts, FIFO. The tick pops from the front. */
  buffer: string[];
  autonomy: Autonomy;
  trainingWheelsRemaining: number;
  paused: boolean;
  pausedReason?: string;
  /** local-day key ('YYYY-MM-DD' in `timezone`) of the last fire ATTEMPT — the exactly-once-per-day guard. */
  lastFiredDayKey?: string;
  createdAtMs: number;
  /** Option-C AI-assist label for THIS loop's posts — the user's choice at create (default false). */
  aiGenerated?: boolean;
}

export interface LoopStore {
  createLoop(loop: LoopRecord): Promise<void>;
  getLoop(id: string): Promise<LoopRecord | null>;
  listLoops(emailHash: string): Promise<LoopRecord[]>;
  /** every loop that could fire — the tick filters by timezone/day/time itself. */
  listActiveLoops(): Promise<LoopRecord[]>;
  updateLoop(loop: LoopRecord): Promise<void>;
  deleteLoop(id: string): Promise<void>;
}

export interface CreateLoopInput {
  emailHash: string;
  timezone: string;
  timeOfDayMinutes: number;
  daysOfWeek: number[];
  posts: string[];
  autonomy?: Autonomy;
  trainingWheelsRemaining?: number;
  /** Option-C: the user's AI-assist labelling choice for this loop's posts (default false). */
  aiGenerated?: boolean;
}

/**
 * A zone must be a NAMED IANA zone that Intl knows (no timezone database of our own to drift).
 * Intl also accepts raw offsets ('+05:30'), which we deliberately reject: an offset is frozen, so a loop
 * created in summer would fire an hour off the moment the zone's DST flips. A named zone tracks that for us.
 */
export function isValidTimezone(tz: string): boolean {
  if (/^[+-]\d{2}:?\d{2}$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export class Loops {
  readonly #store: LoopStore;
  readonly #now: () => number;

  constructor(store: LoopStore, now: () => number) {
    this.#store = store;
    this.#now = now;
  }

  async create(input: CreateLoopInput): Promise<{ loop?: LoopRecord; problems: string[] }> {
    const problems: string[] = [];
    if (!isValidTimezone(input.timezone)) problems.push(`unknown timezone "${input.timezone}" (use an IANA zone like Asia/Kolkata)`);
    if (!Number.isInteger(input.timeOfDayMinutes) || input.timeOfDayMinutes < 0 || input.timeOfDayMinutes > 1439) {
      problems.push('timeOfDayMinutes must be 0..1439 (minutes past local midnight)');
    }
    if (!input.daysOfWeek.length || input.daysOfWeek.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      problems.push('daysOfWeek must be a non-empty list of 0..6 (0=Sunday)');
    }
    // No posts => the loop could never fire, and capx will not write them. Fail at create, loudly,
    // rather than creating a loop that silently pauses on its first tick.
    if (!input.posts.length) problems.push('posts must contain at least one agent-written post (capx does not generate content)');
    if (input.posts.some((p) => !p.trim())) problems.push('posts must not contain empty text');
    if (problems.length) return { problems };

    const loop: LoopRecord = {
      id: randomUUID(),
      emailHash: input.emailHash,
      timezone: input.timezone,
      timeOfDayMinutes: input.timeOfDayMinutes,
      daysOfWeek: [...new Set(input.daysOfWeek)].sort(),
      buffer: [...input.posts],
      autonomy: input.autonomy ?? 'AUTONOMOUS',
      trainingWheelsRemaining: input.trainingWheelsRemaining ?? 0,
      paused: false,
      createdAtMs: this.#now(),
      aiGenerated: input.aiGenerated ?? false,
    };
    await this.#store.createLoop(loop);
    return { loop, problems: [] };
  }

  list(emailHash: string): Promise<LoopRecord[]> {
    return this.#store.listLoops(emailHash);
  }
  get(id: string): Promise<LoopRecord | null> {
    return this.#store.getLoop(id);
  }
  listActive(): Promise<LoopRecord[]> {
    return this.#store.listActiveLoops();
  }

  /** Owner-checked mutation: a loop can only be touched by the session that owns it. */
  async #owned(id: string, emailHash: string): Promise<LoopRecord | null> {
    const loop = await this.#store.getLoop(id);
    return loop && loop.emailHash === emailHash ? loop : null;
  }

  async setPaused(id: string, emailHash: string, paused: boolean): Promise<LoopRecord | null> {
    const loop = await this.#owned(id, emailHash);
    if (!loop) return null;
    const next = { ...loop, paused, pausedReason: paused ? 'paused by user' : undefined };
    await this.#store.updateLoop(next);
    return next;
  }

  /** Refill the buffer with more agent-written posts; un-pauses a loop that ran dry. */
  async topUp(id: string, emailHash: string, posts: string[]): Promise<LoopRecord | null> {
    const loop = await this.#owned(id, emailHash);
    if (!loop) return null;
    const clean = posts.filter((p) => p.trim());
    const wasDry = loop.buffer.length === 0;
    const next: LoopRecord = {
      ...loop,
      buffer: [...loop.buffer, ...clean],
      // only auto-resume a loop that PAUSED because it ran dry — never silently un-pause a user pause
      paused: wasDry && loop.pausedReason === 'buffer empty' ? false : loop.paused,
      pausedReason: wasDry && loop.pausedReason === 'buffer empty' ? undefined : loop.pausedReason,
    };
    await this.#store.updateLoop(next);
    return next;
  }

  // ---- tick-side mutations (server-driven; no owner check — the tick IS the server) ----

  /** Stamp the day AND pop the post in one write: the tick's "stamp before send" step. */
  async consume(id: string, dayKey: string): Promise<void> {
    const loop = await this.#store.getLoop(id);
    if (!loop) return;
    await this.#store.updateLoop({ ...loop, buffer: loop.buffer.slice(1), lastFiredDayKey: dayKey });
  }

  /** Burn a day without consuming a post (used when a post is too late to send). */
  async markFired(id: string, dayKey: string): Promise<void> {
    const loop = await this.#store.getLoop(id);
    if (!loop) return;
    await this.#store.updateLoop({ ...loop, lastFiredDayKey: dayKey });
  }

  /** Give a post back after a transient publish failure (front of the queue — it was next). */
  async restore(id: string, text: string): Promise<void> {
    const loop = await this.#store.getLoop(id);
    if (!loop) return;
    await this.#store.updateLoop({ ...loop, buffer: [text, ...loop.buffer] });
  }

  /** The loop ran out of agent-written posts. Pause and say why — capx will not invent content. */
  async pauseDry(id: string): Promise<void> {
    const loop = await this.#store.getLoop(id);
    if (!loop) return;
    await this.#store.updateLoop({ ...loop, paused: true, pausedReason: 'buffer empty' });
  }

  async remove(id: string, emailHash: string): Promise<boolean> {
    const loop = await this.#owned(id, emailHash);
    if (!loop) return false;
    await this.#store.deleteLoop(id);
    return true;
  }
}
