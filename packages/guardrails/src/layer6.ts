// L6 — Label & log. Produces the audit record and the AI-content labelling decision. Never blocks.
import type { LayerResult, GauntletContext } from './types.ts';
import type { DraftPost } from '../../core/src/index.ts';
import { GuardrailLayer, Verdict } from '../../core/src/index.ts';

export function layer6Audit(
  ctx: GauntletContext,
  post: DraftPost,
  priorResults: LayerResult[],
): LayerResult {
  const layer = GuardrailLayer.L6_AUDIT;
  const aiLabelRequired = post.aiGenerated;
  const audit = {
    at: ctx.now,
    handleId: ctx.handle.id,
    workspaceId: ctx.handle.workspaceId,
    loopId: ctx.loop?.id ?? null,
    model: ctx.loop?.model ?? null,
    brief: ctx.loop?.brief ?? null,
    styleSources: post.styleSources ?? [],
    type: post.type,
    aiGenerated: post.aiGenerated,
    aiLabelRequired,
    layerVerdicts: priorResults.map((r) => ({ layer: r.layer, verdict: r.verdict, reasons: r.reasons })),
  };
  return {
    layer,
    verdict: Verdict.PASS,
    reasons: aiLabelRequired ? ['AI-content label attached'] : [],
    data: { audit, aiLabelRequired },
  };
}
