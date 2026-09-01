import type {
  Verdict,
  GuardrailLayer,
  Tier,
  Handle,
  LoopConfig,
  PostHistoryItem,
  AccountHealth,
  KillSwitch,
} from '@capx-cafe/core';

export interface LayerResult {
  layer: GuardrailLayer;
  verdict: Verdict;
  reasons: string[];
  data?: Record<string, unknown>;
}

export interface GauntletContext {
  tier: Tier;
  handle: Handle;
  /** present when the post originates from a Loop; absent for a plain manual post. */
  loop?: LoopConfig;
  /** the account's recent posts (for duplication + rate checks). */
  history: PostHistoryItem[];
  /** this loop's recent generated texts (for the variation engine). */
  loopRecentOutputs?: string[];
  health?: AccountHealth;
  /** epoch ms — caller supplies so the pipeline is pure/deterministic. */
  now: number;
  /** max AI/scheduled posts per 24h across ALL loops + manual (closes the multi-loop loophole). */
  accountDailyCeiling: number;
  /** anti-spam velocity cap: max posts per rolling hour (locked 2026-09-01: 10/h product-wide).
   *  Optional so pre-existing callers/tests keep compiling; omitted = no hourly check. */
  accountHourlyCeiling?: number;
  /**
   * REQUIRED (§6 hardening): the live revocation signal. The chokepoint always populates it from the
   * live kill-list; making it non-optional turns an omitted kill-switch into a compile error rather
   * than a silent L1 no-op. The gate additionally throws at runtime as defense-in-depth.
   */
  killSwitch: KillSwitch;
}

export interface GauntletResult {
  verdict: Verdict;
  finalReasons: string[];
  layerResults: LayerResult[];
  /** true = do not auto-post; route to a human (HOLD, user-reviewed mode, or training wheels). */
  requiresHumanReview: boolean;
  /** jittered scheduled time from L2 (never exactly on the :00). */
  scheduledAtMs?: number;
  audit: Record<string, unknown>;
}
