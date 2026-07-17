import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localNow, jitterMinutes, isDue, MAX_LATENESS_MINUTES } from '../src/loops/schedule.ts';
import type { LoopRecord } from '../src/loops/index.ts';

const loop = (o: Partial<LoopRecord> = {}): LoopRecord => ({
  id: 'loop-1',
  emailHash: 'h_abc',
  timezone: 'Asia/Kolkata',
  timeOfDayMinutes: 9 * 60, // 09:00 local
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  buffer: ['a post'],
  autonomy: 'AUTONOMOUS',
  trainingWheelsRemaining: 0,
  paused: false,
  createdAtMs: 0,
  ...o,
});

/** The instant at which the loop's local wall clock reads `hhmm`, given the jitter for that day. */
function atLocal(tz: string, iso: string): number {
  return Date.parse(iso);
}

test('localNow reads the wall clock in the loop zone, not the server zone', () => {
  // 2026-07-17T03:30:00Z == 09:00 in Kolkata (UTC+5:30)
  const l = localNow(Date.parse('2026-07-17T03:30:00Z'), 'Asia/Kolkata');
  assert.equal(l.dayKey, '2026-07-17');
  assert.equal(l.minutes, 9 * 60);
  assert.equal(l.dayOfWeek, 5); // Friday

  // same instant is a different local day in New York (still 2026-07-16, 23:30)
  const ny = localNow(Date.parse('2026-07-17T03:30:00Z'), 'America/New_York');
  assert.equal(ny.dayKey, '2026-07-16');
  assert.equal(ny.minutes, 23 * 60 + 30);
});

test('localNow handles midnight without wrapping to hour 24', () => {
  const l = localNow(Date.parse('2026-07-16T18:30:00Z'), 'Asia/Kolkata'); // 00:00 IST on the 17th
  assert.equal(l.minutes, 0);
  assert.equal(l.dayKey, '2026-07-17');
});

test('jitter is deterministic per (loop, day) and bounded — a retried tick must not shift the target', () => {
  const a = jitterMinutes('loop-1', '2026-07-17');
  assert.equal(a, jitterMinutes('loop-1', '2026-07-17'), 'same inputs -> same jitter (no double-post window)');
  assert.notEqual(a, jitterMinutes('loop-1', '2026-07-18'), 'different day -> different jitter');
  for (const d of ['2026-07-17', '2026-07-18', '2026-07-19', '2026-08-01']) {
    const j = jitterMinutes('loop-1', d);
    assert.ok(j >= -12 && j <= 12, `jitter ${j} within +/-12`);
  }
});

test('fires once, in-window, on its weekday', () => {
  const L = loop();
  const j = jitterMinutes(L.id, '2026-07-17');
  const target = 9 * 60 + j;

  // one minute before target -> too early
  const early = Date.parse('2026-07-17T03:30:00Z') + (j - 1) * 60_000;
  assert.deepEqual(isDue(L, early), { fire: false, reason: 'too-early', dayKey: '2026-07-17' });

  // at target -> fire
  const on = Date.parse('2026-07-17T03:30:00Z') + j * 60_000;
  assert.deepEqual(isDue(L, on), { fire: true, dayKey: '2026-07-17' });
});

test('EXACTLY-ONCE: once lastFiredDayKey is stamped, further ticks that day do not fire', () => {
  const on = Date.parse('2026-07-17T03:30:00Z') + jitterMinutes('loop-1', '2026-07-17') * 60_000;
  const fired = loop({ lastFiredDayKey: '2026-07-17' });
  assert.deepEqual(isDue(fired, on), { fire: false, reason: 'already-fired', dayKey: '2026-07-17' });
  // ...but the NEXT local day is eligible again
  const nextDay = on + 24 * 60 * 60_000;
  assert.equal(isDue(fired, nextDay).fire, true);
});

test('MAX_LATENESS: a poller outage skips the day rather than posting stale', () => {
  const j = jitterMinutes('loop-1', '2026-07-17');
  const base = Date.parse('2026-07-17T03:30:00Z') + j * 60_000;
  // just inside the window
  assert.equal(isDue(loop(), base + (MAX_LATENESS_MINUTES - 1) * 60_000).fire, true);
  // just outside -> burn the day, do NOT post 2h+ late
  assert.deepEqual(isDue(loop(), base + (MAX_LATENESS_MINUTES + 1) * 60_000), {
    fire: false,
    reason: 'too-late',
    dayKey: '2026-07-17',
  });
});

test('DST: a 09:00 New York loop still fires at 09:00 LOCAL across the spring-forward boundary', () => {
  // US DST 2026 begins Sun 2026-03-08. 09:00 EST = 14:00Z (before), 09:00 EDT = 13:00Z (after).
  const L = loop({ timezone: 'America/New_York', timeOfDayMinutes: 9 * 60 });

  const beforeKey = '2026-03-07';
  const jB = jitterMinutes(L.id, beforeKey);
  const before = Date.parse('2026-03-07T14:00:00Z') + jB * 60_000; // 09:00 EST
  assert.equal(localNow(before, 'America/New_York').minutes, 9 * 60 + jB);
  assert.equal(isDue(L, before).fire, true);

  const afterKey = '2026-03-09';
  const jA = jitterMinutes(L.id, afterKey);
  const after = Date.parse('2026-03-09T13:00:00Z') + jA * 60_000; // 09:00 EDT — one hour earlier in UTC
  assert.equal(localNow(after, 'America/New_York').minutes, 9 * 60 + jA);
  assert.equal(isDue(L, after).fire, true, 'still 9am local after the clocks moved');

  // the same UTC instant that WAS 09:00 local is now 10:00 local — proves we track the zone, not an offset
  assert.equal(localNow(Date.parse('2026-03-09T14:00:00Z'), 'America/New_York').minutes, 10 * 60);
});

/** Narrow the union for assertions: 'fired' when it would fire, else the refusal reason. */
const why = (d: ReturnType<typeof isDue>): string => (d.fire ? 'fired' : d.reason);

test('skips non-scheduled weekdays, paused loops, and an empty buffer', () => {
  const on = Date.parse('2026-07-17T03:30:00Z') + jitterMinutes('loop-1', '2026-07-17') * 60_000; // Friday
  assert.equal(why(isDue(loop({ daysOfWeek: [1] }), on)), 'not-today'); // Mondays only
  assert.equal(why(isDue(loop({ paused: true }), on)), 'paused');
  assert.equal(why(isDue(loop({ buffer: [] }), on)), 'buffer-empty');
});

test('a near-midnight loop cannot wrap into the adjacent day via jitter', () => {
  // 00:03 local with a -12 jitter would be -9 minutes; must clamp to 00:00, not wrap to 23:51 prior day.
  const L = loop({ timeOfDayMinutes: 3 });
  const midnight = Date.parse('2026-07-16T18:30:00Z'); // 00:00 IST on the 17th
  const d = isDue(L, midnight);
  assert.ok(d.fire || d.reason === 'too-early', `clamped, got ${JSON.stringify(d)}`);
  assert.equal(d.dayKey, '2026-07-17');
});
