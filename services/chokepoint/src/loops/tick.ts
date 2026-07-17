// The tick: Cloud Run scales to zero, so there is no always-on scheduler. Cloud Scheduler POSTs
// /internal/tick every few minutes and THIS decides what fires.
//
// The two rules that keep it honest:
// 1. STAMP BEFORE SEND. lastFiredDayKey is written *before* the publish attempt, so a crash (or two
//    overlapping ticks, or Cloud Run running >1 instance) can at worst SKIP a day — never double-post.
//    Losing a post is recoverable; posting twice to someone's timeline is not. The outbox idempotency
//    key (loop:<id>:<dayKey>) is the second line of defence.
// 2. capx never writes content. The tick POPS agent-authored text. Empty buffer => pause + say so.
import type { Loops, LoopRecord } from './index.ts';
import { isDue } from './schedule.ts';
import type { PublishGate, PostResult } from '../gate/index.ts';

export interface TickOutcome {
  loopId: string;
  fired: boolean;
  reason: string;
  outcome?: PostResult['outcome'];
}

export interface TickDeps {
  loops: Loops;
  gate: PublishGate;
  now: () => number;
}

export class LoopTicker {
  readonly #loops: Loops;
  readonly #gate: PublishGate;
  readonly #now: () => number;

  constructor(deps: TickDeps) {
    this.#loops = deps.loops;
    this.#gate = deps.gate;
    this.#now = deps.now;
  }

  async tick(): Promise<TickOutcome[]> {
    const now = this.#now();
    const active = await this.#loops.listActive();
    const out: TickOutcome[] = [];
    for (const loop of active) {
      out.push(await this.#one(loop, now));
    }
    return out;
  }

  async #one(loop: LoopRecord, now: number): Promise<TickOutcome> {
    const due = isDue(loop, now);

    if (!due.fire) {
      // 'too-late' burns the day so a recovered poller doesn't fire a stale post hours later.
      if (due.reason === 'too-late') {
        await this.#loops.markFired(loop.id, due.dayKey);
        return { loopId: loop.id, fired: false, reason: 'skipped: too late (poller outage?) — day burned' };
      }
      // Ran dry: pause and tell the user. capx will not write a post to fill the gap.
      if (due.reason === 'buffer-empty') {
        await this.#loops.pauseDry(loop.id);
        return { loopId: loop.id, fired: false, reason: 'paused: buffer empty — top it up with new posts' };
      }
      return { loopId: loop.id, fired: false, reason: due.reason };
    }

    const text = loop.buffer[0];
    if (!text) return { loopId: loop.id, fired: false, reason: 'buffer-empty' };

    // STAMP FIRST (see header): consume the day + the buffer item before attempting the send.
    await this.#loops.consume(loop.id, due.dayKey);

    const result = await this.#gate.postFromLoop({
      emailHash: loop.emailHash,
      loop,
      text,
      idempotencyKey: `loop:${loop.id}:${due.dayKey}`,
      now,
    });

    // A transient X failure gives the post back so the next run can retry it — but the DAY stays burned,
    // so the retry happens tomorrow rather than hammering X inside the lateness window.
    if (result.outcome === 'publish_failed') await this.#loops.restore(loop.id, text);

    return { loopId: loop.id, fired: result.outcome === 'published', reason: result.finalReasons.join('; ') || result.outcome, outcome: result.outcome };
  }
}
