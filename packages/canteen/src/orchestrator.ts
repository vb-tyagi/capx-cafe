// The Loop tick — the publishing chokepoint. Composes guardrails + credits + platform-client:
// a post reaches the platform adapter ONLY if the gauntlet passes AND (autonomous, no review)
// AND credits are affordable. Credits are charged only on an actual publish.
import type { DraftPost } from '@capx-cafe/core';
import { ActionType, TweetType, Verdict } from '@capx-cafe/core';
import { runGauntlet } from '@capx-cafe/casserole';
import type { GauntletContext, GauntletResult } from '@capx-cafe/casserole';
import { CreditLedger } from '@capx-cafe/counter';
import type { PlatformClient, PublishResult } from '@capx-cafe/platform-client';

/** Which billable actions a draft incurs (generation + the posting action). */
export function actionsForDraft(post: DraftPost): ActionType[] {
  const actions: ActionType[] = [];
  if (post.aiGenerated) {
    actions.push(ActionType.AI_TEXT_GEN);
    if (post.type === TweetType.GRAPHIC) actions.push(ActionType.AI_IMAGE_GEN);
  }
  actions.push(
    post.hasLink
      ? ActionType.POST_LINK
      : post.type === TweetType.GRAPHIC
        ? ActionType.POST_GRAPHIC
        : ActionType.POST_TEXT,
  );
  return actions;
}

export type LoopOutcome =
  | 'published'
  | 'held_for_review'
  | 'regenerate'
  | 'blocked'
  | 'insufficient_credits';

export interface LoopRunResult {
  outcome: LoopOutcome;
  gauntlet: GauntletResult;
  actions: ActionType[];
  creditsCharged: number;
  publish?: PublishResult;
  reasons: string[];
}

export async function runLoopTick(
  post: DraftPost,
  ctx: GauntletContext,
  ledger: CreditLedger,
  client: PlatformClient,
): Promise<LoopRunResult> {
  const gauntlet = runGauntlet(post, ctx);
  const actions = actionsForDraft(post);
  const reasons = gauntlet.finalReasons;
  const base = { gauntlet, actions, creditsCharged: 0, reasons };

  if (gauntlet.verdict === Verdict.BLOCK) return { ...base, outcome: 'blocked' };
  if (gauntlet.requiresHumanReview) return { ...base, outcome: 'held_for_review' };
  if (gauntlet.verdict === Verdict.REGENERATE) return { ...base, outcome: 'regenerate' };

  // PASS + autonomous: verify affordability, publish, then charge (platform fronts the fee).
  const total = actions.reduce((sum, a) => sum + ledger.quote(a).credits, 0);
  if (ledger.getBalance() < total) return { ...base, outcome: 'insufficient_credits' };

  const publish = await client.publish({
    channelId: ctx.handle.id,
    text: post.text,
    scheduledAtMs: gauntlet.scheduledAtMs ?? ctx.now,
    aiLabel: post.aiGenerated,
  });

  let creditsCharged = 0;
  for (const a of actions) {
    const entry = ledger.charge(a, ctx.now, `loop:${ctx.loop?.id ?? 'manual'}`);
    creditsCharged += -entry.credits;
  }
  return { ...base, outcome: 'published', creditsCharged, publish };
}
