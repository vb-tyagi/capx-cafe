import type {
  Verdict,
  GuardrailLayer,
  Tier,
  Handle,
  LoopConfig,
  PostHistoryItem,
  AccountHealth,
} from '../../core/src/index.ts';

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
  killSwitch?: { global: boolean; handle: boolean };
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
