// L1 — Eligibility. Kill switches + Loops gating (verified, >=30d, good standing).
//
// The old "TEAM+ tier" gate was REMOVED (decided 2026-07-17): tiers were the paid-SaaS billing model,
// which the Option-B pivot killed — under BYO every allowlisted user is equivalent, so gating Loops on
// `tier` gated on a field that no longer means anything. The ACCOUNT-HEALTH gates stay: they are real
// anti-abuse and map to X's own Automation Rules (relevant to the legal sign-off), and they are what
// stops a fresh throwaway account from running autonomous posting.
import type { LayerResult, GauntletContext } from './types.ts';
import { GuardrailLayer, Verdict, AccountStanding, LOOP_MIN_ACCOUNT_AGE_DAYS } from '@capx/core';

export function layer1Eligibility(ctx: GauntletContext): LayerResult {
  const layer = GuardrailLayer.L1_ELIGIBILITY;
  if (ctx.killSwitch.global) return { layer, verdict: Verdict.BLOCK, reasons: ['global kill switch active'] };
  if (ctx.killSwitch.handle) return { layer, verdict: Verdict.BLOCK, reasons: ['handle kill switch active'] };

  const reasons: string[] = [];
  if (ctx.loop) {
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
