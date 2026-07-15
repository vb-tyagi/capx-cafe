// L2 — Rate. Per-loop 1/day, account daily ceiling, minimum spacing, and deterministic
// posting-time jitter (never fires exactly on the :00).
import type { LayerResult, GauntletContext } from './types.ts';
import { GuardrailLayer, Verdict } from '@capx/core';

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_SPACING_MS = 5 * 60 * 1000;
const MAX_JITTER_MIN = 12;

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic jitter (±12 min + a nonzero seconds offset) so scheduling never looks robotic. */
export function computeScheduledTime(loopId: string, baseEpochMs: number): number {
  const dayIndex = Math.floor(baseEpochMs / DAY_MS);
  const h = hashStr(`${loopId}:${dayIndex}`);
  const jitterMin = (h % (2 * MAX_JITTER_MIN + 1)) - MAX_JITTER_MIN;
  const jitterSec = 5 + (h % 50); // 5..54s, guarantees it is never exactly on the minute
  return baseEpochMs + jitterMin * 60_000 + jitterSec * 1000;
}

export function layer2Rate(ctx: GauntletContext): LayerResult {
  const layer = GuardrailLayer.L2_RATE;
  const reasons: string[] = [];
  const { now } = ctx;
  const recent = ctx.history.filter((p) => now - p.postedAt < DAY_MS);

  if (recent.length >= ctx.accountDailyCeiling) {
    reasons.push(`account daily ceiling reached (${recent.length}/${ctx.accountDailyCeiling})`);
  }
  if (ctx.loop) {
    const loopToday = recent.filter((p) => p.loopId === ctx.loop!.id);
    if (loopToday.length >= 1) reasons.push('loop already posted in the last 24h (max 1/day)');
  }
  if (ctx.history.some((p) => Math.abs(now - p.postedAt) < MIN_SPACING_MS)) {
    reasons.push('another post within the minimum spacing window');
  }

  const scheduledAtMs = ctx.loop ? computeScheduledTime(ctx.loop.id, now) : now;
  return {
    layer,
    verdict: reasons.length ? Verdict.BLOCK : Verdict.PASS,
    reasons,
    data: { scheduledAtMs },
  };
}
