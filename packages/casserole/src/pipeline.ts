// The gauntlet. Runs L1..L6 in order; autonomous mode skips only the human tap (L4 review),
// never the automated layers. verdict = worst across all layers (audit never worsens it).
import type { GauntletContext, GauntletResult, LayerResult } from './types.ts';
import type { DraftPost } from '@capx/core';
import { Verdict, Autonomy } from '@capx/core';
import { worst } from './verdict.ts';
import { layer1Eligibility } from './layer1.ts';
import { layer2Rate } from './layer2.ts';
import { layer3Quality } from './layer3.ts';
import { layer4Authenticity } from './layer4.ts';
import { layer5Monitoring } from './layer5.ts';
import { layer6Audit } from './layer6.ts';

export function runGauntlet(post: DraftPost, ctx: GauntletContext): GauntletResult {
  const results: LayerResult[] = [];

  const l1 = layer1Eligibility(ctx);
  results.push(l1);

  let scheduledAtMs: number | undefined;
  if (l1.verdict !== Verdict.BLOCK) {
    const l2 = layer2Rate(ctx);
    results.push(l2);
    scheduledAtMs = l2.data?.scheduledAtMs as number | undefined;
    if (l2.verdict !== Verdict.BLOCK) {
      results.push(layer3Quality(ctx, post));
      results.push(layer4Authenticity(ctx, post));
      results.push(layer5Monitoring(ctx));
    }
  }

  const l6 = layer6Audit(ctx, post, results);
  results.push(l6);

  // Layer 6 (audit) is always PASS, so it never changes the verdict.
  const verdict = results.reduce<Verdict>((acc, r) => worst(acc, r.verdict), Verdict.PASS);

  const reviewedMode = ctx.loop?.autonomy === Autonomy.USER_REVIEWED;
  const trainingWheels = (ctx.loop?.trainingWheelsRemaining ?? 0) > 0;
  const requiresHumanReview =
    verdict !== Verdict.BLOCK && (verdict === Verdict.HOLD || reviewedMode || trainingWheels);

  const finalReasons = results.flatMap((r) => r.reasons.map((x) => `[${r.layer}] ${x}`));

  return {
    verdict,
    finalReasons,
    layerResults: results,
    requiresHumanReview,
    scheduledAtMs,
    audit: (l6.data?.audit as Record<string, unknown>) ?? {},
  };
}
