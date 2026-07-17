// L5 — Watch & kill. Account-health signals auto-pause Loops (mandatory for autonomous mode).
import type { LayerResult, GauntletContext } from './types.ts';
import { GuardrailLayer, Verdict } from '@capx-cafe/core';
import { worst } from './verdict.ts';

const FOLLOWER_DROP_THRESHOLD = -50;

export function layer5Monitoring(ctx: GauntletContext): LayerResult {
  const layer = GuardrailLayer.L5_MONITORING;
  const reasons: string[] = [];
  let verdict: Verdict = Verdict.PASS;
  const h = ctx.health;

  if (h) {
    if (h.platformFlags > 0) {
      reasons.push(`platform flags present (${h.platformFlags}) — auto-pause`);
      verdict = worst(verdict, Verdict.BLOCK);
    }
    if (h.followerDelta24h <= FOLLOWER_DROP_THRESHOLD) {
      reasons.push(`sharp follower drop (${h.followerDelta24h}/24h) — auto-pause`);
      verdict = worst(verdict, Verdict.BLOCK);
    }
    if (h.replyRatioAnomaly) {
      reasons.push('reply-ratio anomaly — hold for review');
      verdict = worst(verdict, Verdict.HOLD);
    }
  }

  return { layer, verdict, reasons, data: { autoPause: verdict === Verdict.BLOCK } };
}
