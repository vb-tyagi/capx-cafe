// The scheduling brain: "should this loop fire right now?" — PURE (no I/O, no clock, no store) so every
// nasty case (DST, lateness, exactly-once, jitter) is unit-testable with plain values.
//
// Design notes that matter:
// - We compare LOCAL WALL-CLOCK MINUTES, never epoch arithmetic. Converting "9am on 2026-03-08 in
//   America/New_York" to an instant is the direction that breaks at DST (that local time may not exist,
//   or may exist twice). Reading "what is the local time right now" is always well-defined, so we do that
//   and compare. DST then costs at most one skipped/shifted day, never a wrong-hour post.
// - The exactly-once key is the LOCAL day (YYYY-MM-DD in the loop's zone), not a UTC day: a user in
//   Kolkata expects one post per THEIR day.
// - Jitter is deterministic per (loop, local day) so a restarted/duplicated tick computes the SAME fire
//   minute — jitter must never become a source of double-posting.
import type { LoopRecord } from './index.ts';

/** How late a post may fire. Beyond this the day is skipped: never auto-post something stale. */
export const MAX_LATENESS_MINUTES = 120;
const MAX_JITTER_MINUTES = 12;

export interface LocalNow {
  dayKey: string; // 'YYYY-MM-DD' in the zone
  dayOfWeek: number; // 0=Sun..6=Sat in the zone
  minutes: number; // minutes past local midnight
}

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Read the wall clock in `timezone` at instant `nowMs`. Always well-defined (unlike local->instant). */
export function localNow(nowMs: number, timezone: string): LocalNow {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(new Date(nowMs));
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
  // hourCycle h23 can render midnight as '24' in some ICU versions; normalise.
  const hour = Number(get('hour')) % 24;
  return {
    dayKey: `${get('year')}-${get('month')}-${get('day')}`,
    dayOfWeek: DOW[get('weekday')] ?? 0,
    minutes: hour * 60 + Number(get('minute')),
    };
}

/** Deterministic per (loop, local day) jitter in [-12, +12] minutes, so fire times never look robotic. */
export function jitterMinutes(loopId: string, dayKey: string): number {
  let h = 2166136261;
  const s = `${loopId}:${dayKey}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % (2 * MAX_JITTER_MINUTES + 1)) - MAX_JITTER_MINUTES;
}

export type DueDecision =
  | { fire: true; dayKey: string }
  | { fire: false; reason: 'paused' | 'not-today' | 'too-early' | 'too-late' | 'already-fired' | 'buffer-empty'; dayKey: string };

/**
 * Should `loop` fire at `nowMs`? A loop fires once per LOCAL day, on its configured weekday, within
 * [scheduled+jitter, scheduled+jitter+MAX_LATENESS]. `too-late` deliberately BURNS the day (the caller
 * stamps lastFiredDayKey) so a poller outage never dumps a stale post hours later.
 */
export function isDue(loop: LoopRecord, nowMs: number): DueDecision {
  const l = localNow(nowMs, loop.timezone);
  if (loop.paused) return { fire: false, reason: 'paused', dayKey: l.dayKey };
  if (loop.lastFiredDayKey === l.dayKey) return { fire: false, reason: 'already-fired', dayKey: l.dayKey };
  if (!loop.daysOfWeek.includes(l.dayOfWeek)) return { fire: false, reason: 'not-today', dayKey: l.dayKey };

  // Clamp into the day so a jittered 00:05 can't wrap to the previous day (and 23:58 to the next).
  const target = Math.min(1439, Math.max(0, loop.timeOfDayMinutes + jitterMinutes(loop.id, l.dayKey)));
  if (l.minutes < target) return { fire: false, reason: 'too-early', dayKey: l.dayKey };
  if (l.minutes - target > MAX_LATENESS_MINUTES) return { fire: false, reason: 'too-late', dayKey: l.dayKey };
  if (loop.buffer.length === 0) return { fire: false, reason: 'buffer-empty', dayKey: l.dayKey };
  return { fire: true, dayKey: l.dayKey };
}
