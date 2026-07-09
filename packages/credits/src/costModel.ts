// @capx/credits — cost model.
// All money is integer micro-USD (1 USD = 1_000_000) to avoid floating-point drift.
// User-facing spend is "credits": 1 credit = $0.001.

import type { ActionType, Tier } from '../../core/src/index.ts';
import { TIER_LIMITS } from '../../core/src/index.ts';

export const MICRO_USD_PER_CREDIT = 1000; // 1 credit = $0.001

/** Fronted provider cost per action, in micro-USD. Verify exact X rates in the live Developer Console. */
export const BASE_COST_MICRO_USD: Record<ActionType, number> = {
  POST_TEXT: 15000, // $0.015
  POST_GRAPHIC: 15000, // $0.015 (image generation billed separately via AI_IMAGE_GEN)
  POST_LINK: 200000, // $0.20 — platform penalises links ~13x
  READ: 5000, // $0.005
  AI_TEXT_GEN: 10000, // ~$0.01
  AI_IMAGE_GEN: 50000, // ~$0.05
};

export interface CostBreakdown {
  action: ActionType;
  tier: Tier;
  baseCostMicroUsd: number;
  markupPct: number;
  chargedMicroUsd: number;
  credits: number;
}

/** Pre-flight cost of a single action for a tier. Markup is baked in invisibly. */
export function preflightCost(action: ActionType, tier: Tier): CostBreakdown {
  const base = BASE_COST_MICRO_USD[action];
  const markupPct = TIER_LIMITS[tier].markupPct;
  const chargedMicroUsd = Math.round(base * (1 + markupPct));
  const credits = Math.ceil(chargedMicroUsd / MICRO_USD_PER_CREDIT);
  return { action, tier, baseCostMicroUsd: base, markupPct, chargedMicroUsd, credits };
}

/** Composite cost, e.g. a graphic tweet = AI_IMAGE_GEN + POST_GRAPHIC. */
export function preflightComposite(
  actions: ActionType[],
  tier: Tier,
): { credits: number; parts: CostBreakdown[] } {
  const parts = actions.map((a) => preflightCost(a, tier));
  const credits = parts.reduce((sum, p) => sum + p.credits, 0);
  return { credits, parts };
}
