// L1 — Eligibility. Kill switches + Loops gating (TEAM+, verified, >=30d, good standing).
import type { LayerResult, GauntletContext } from './types.ts';
import {
  GuardrailLayer,
  Verdict,
  TIER_LIMITS,
  AccountStanding,
  LOOP_MIN_ACCOUNT_AGE_DAYS,
} from '@capx/core';

export function layer1Eligibility(ctx: GauntletContext): LayerResult {
  const layer = GuardrailLayer.L1_ELIGIBILITY;
  if (ctx.killSwitch?.global) return { layer, verdict: Verdict.BLOCK, reasons: ['global kill switch active'] };
  if (ctx.killSwitch?.handle) return { layer, verdict: Verdict.BLOCK, reasons: ['handle kill switch active'] };

  const reasons: string[] = [];
  if (ctx.loop) {
    if (!TIER_LIMITS[ctx.tier].loopsEnabled) reasons.push(`tier ${ctx.tier} cannot use Loops (TEAM+ only)`);
    if (!ctx.handle.verified) reasons.push('handle not verified — blue tick required for Loops');
    if (ctx.handle.ageDays < LOOP_MIN_ACCOUNT_AGE_DAYS) {
      reasons.push(`handle too new (${ctx.handle.ageDays}d < ${LOOP_MIN_ACCOUNT_AGE_DAYS}d)`);
    }
    if (ctx.handle.standing !== AccountStanding.GOOD) {
      reasons.push(`handle standing ${ctx.handle.standing} — must be GOOD`);
    }
  }
  return { layer, verdict: reasons.length ? Verdict.BLOCK : Verdict.PASS, reasons };
}
