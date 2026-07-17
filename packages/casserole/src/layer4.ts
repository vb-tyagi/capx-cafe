// L4 — Authenticity. Variation engine (vs the loop's own recent output) + style-source sanity.
import type { LayerResult, GauntletContext } from './types.ts';
import type { DraftPost } from '@capx-cafe/core';
import { GuardrailLayer, Verdict } from '@capx-cafe/core';
import { similarity } from './text.ts';
import { worst } from './verdict.ts';

export function layer4Authenticity(ctx: GauntletContext, post: DraftPost): LayerResult {
  const layer = GuardrailLayer.L4_AUTHENTICITY;
  const reasons: string[] = [];
  let verdict: Verdict = Verdict.PASS;

  // style calibration must stay <= 3 profiles (cloning risk otherwise)
  if (post.styleSources && post.styleSources.length > 3) {
    reasons.push('more than 3 style profiles (cloning risk) — block');
    verdict = worst(verdict, Verdict.BLOCK);
  }

  // variation engine: don't let a loop read like a template
  if (ctx.loopRecentOutputs && ctx.loopRecentOutputs.length) {
    let maxSim = 0;
    for (const prev of ctx.loopRecentOutputs) {
      const s = similarity(post.text, prev);
      if (s > maxSim) maxSim = s;
    }
    if (maxSim >= 0.72) {
      reasons.push(`repetitive vs this loop's recent output (sim=${maxSim.toFixed(2)}) — regenerate for variation`);
      verdict = worst(verdict, Verdict.REGENERATE);
    }
  }

  return { layer, verdict, reasons };
}
