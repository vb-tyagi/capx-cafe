// @capx/core — shared domain types & constants.
// NOTE: TS `enum`, namespaces, parameter-properties and decorators are intentionally
// avoided so every file runs directly under `node --experimental-strip-types`.

// ---- Enumerated constants (const objects + union types) ----
export const Tier = { SOLO: 'SOLO', TEAM: 'TEAM', ORG: 'ORG' } as const;
export type Tier = (typeof Tier)[keyof typeof Tier];

export const Platform = { X: 'X', LINKEDIN: 'LINKEDIN' } as const;
export type Platform = (typeof Platform)[keyof typeof Platform];

export const TweetType = { TEXT: 'TEXT', GRAPHIC: 'GRAPHIC', ESSAY: 'ESSAY' } as const;
export type TweetType = (typeof TweetType)[keyof typeof TweetType];

export const Autonomy = { AUTONOMOUS: 'AUTONOMOUS', USER_REVIEWED: 'USER_REVIEWED' } as const;
export type Autonomy = (typeof Autonomy)[keyof typeof Autonomy];

export const AccountStanding = { GOOD: 'GOOD', FLAGGED: 'FLAGGED', SUSPENDED: 'SUSPENDED' } as const;
export type AccountStanding = (typeof AccountStanding)[keyof typeof AccountStanding];

export const Role = { OWNER: 'OWNER', MANAGER: 'MANAGER', CREATOR: 'CREATOR', VIEWER: 'VIEWER' } as const;
export type Role = (typeof Role)[keyof typeof Role];

export const Verdict = { PASS: 'PASS', HOLD: 'HOLD', REGENERATE: 'REGENERATE', BLOCK: 'BLOCK' } as const;
export type Verdict = (typeof Verdict)[keyof typeof Verdict];

export const GuardrailLayer = {
  L1_ELIGIBILITY: 'L1_ELIGIBILITY',
  L2_RATE: 'L2_RATE',
  L3_QUALITY: 'L3_QUALITY',
  L4_AUTHENTICITY: 'L4_AUTHENTICITY',
  L5_MONITORING: 'L5_MONITORING',
  L6_AUDIT: 'L6_AUDIT',
} as const;
export type GuardrailLayer = (typeof GuardrailLayer)[keyof typeof GuardrailLayer];

export const ActionType = {
  POST_TEXT: 'POST_TEXT',
  POST_LINK: 'POST_LINK',
  POST_GRAPHIC: 'POST_GRAPHIC',
  READ: 'READ',
  AI_TEXT_GEN: 'AI_TEXT_GEN',
  AI_IMAGE_GEN: 'AI_IMAGE_GEN',
} as const;
export type ActionType = (typeof ActionType)[keyof typeof ActionType];

// ---- Tier capabilities ----
export interface TierLimits {
  maxHandles: number;
  loopsEnabled: boolean;
  /** markup applied on top of the fronted provider cost (0.30–0.60). Higher tiers = better rate. */
  markupPct: number;
  /** credits granted free on signup (1 credit = $0.001). */
  freeStarterCredits: number;
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  SOLO: { maxHandles: 1, loopsEnabled: false, markupPct: 0.6, freeStarterCredits: 2000 },
  TEAM: { maxHandles: 3, loopsEnabled: true, markupPct: 0.45, freeStarterCredits: 6000 },
  ORG: { maxHandles: 3, loopsEnabled: true, markupPct: 0.3, freeStarterCredits: 15000 },
};

/** Hard cap on handles per user "for now" (Decision #2). */
export const HANDLE_CAP = 3;
/** Loops require the account to be at least this old (Loops eligibility). */
export const LOOP_MIN_ACCOUNT_AGE_DAYS = 30;

// ---- Domain shapes ----
export interface Handle {
  id: string;
  workspaceId: string;
  platform: Platform;
  username: string;
  /** blue tick */
  verified: boolean;
  ageDays: number;
  standing: AccountStanding;
  connectedAt: number; // epoch ms
}

export interface DraftPost {
  text: string;
  type: TweetType;
  hasLink: boolean;
  aiGenerated: boolean;
  hashtags: string[];
  loopId?: string;
  /** up to 3 profiles used as STYLE CALIBRATION (never verbatim cloning). */
  styleSources?: string[];
}

export interface PostHistoryItem {
  text: string;
  postedAt: number; // epoch ms
  loopId?: string;
}

export interface LoopConfig {
  id: string;
  handleId: string;
  timeOfDayMinutes: number; // minutes past local midnight
  daysOfWeek: number[]; // 0=Sun..6=Sat
  type: TweetType;
  model: string;
  category: string;
  tags: string[];
  brief: string; // < 500 words
  styleSources: string[]; // <= 3
  autonomy: Autonomy;
  /** forces user-review for the first N posts of a new loop. */
  trainingWheelsRemaining: number;
}

export interface AccountHealth {
  followerDelta24h: number;
  replyRatioAnomaly: boolean;
  platformFlags: number; // count of platform warnings / locks
}

// ---- Option B chokepoint primitives (P1) ----
// Model the hosted chokepoint's server-side surface (vault / session / lane / kill-switch / outbox).
// The agent-co-resident MCP server holds only a SessionHandle — NEVER a token. See docs/P1-CHOKEPOINT.md.

export const Lane = { BYO: 'BYO', CAPX_APP: 'CAPX_APP' } as const;
export type Lane = (typeof Lane)[keyof typeof Lane];

/** The live revocation signal casserole L1 consumes. Resolved server-side before every send. */
export interface KillSwitch {
  global: boolean;
  handle: boolean;
}

/**
 * The short-TTL credential the agent-co-resident MCP server holds. It is NOT an X token — it only
 * authorizes calls to the chokepoint and is revocable. The signed bearer string is opaque to the
 * client; these are the claims the chokepoint validates.
 */
export interface SessionHandle {
  /** hash of the allowlisted email (no PII). Identity key across vault / kill-list / audit. */
  emailHash: string;
  issuedAt: number; // epoch ms
  expiresAt: number; // epoch ms
}

/** Result of validating a SessionHandle against the allowlist + cached grace window. */
export interface SessionValidation {
  valid: boolean;
  /** true when past expiry but within the cached grace window. */
  inGrace: boolean;
  expiresAt: number;
}

/**
 * Server-side reference to a connected X account — connection METADATA only, NEVER a token.
 * The ciphertext token lives in the vault, reachable only via the vault module's withToken().
 */
export interface XConnectionRef {
  vaultRef: string;
  emailHash: string;
  xUserId: string;
  username: string;
  lane: Lane;
  standing: AccountStanding;
}

export const OutboxState = {
  PENDING: 'PENDING',
  SENDING: 'SENDING',
  SENT: 'SENT',
  PUBLISH_FAILED: 'PUBLISH_FAILED',
} as const;
export type OutboxState = (typeof OutboxState)[keyof typeof OutboxState];

/**
 * A durable send job. The idempotencyKey makes a retried worker tick at-most-once for charging and
 * is the basis for best-effort de-dup at the X boundary (X has no native idempotency key).
 */
export interface OutboxJob {
  id: string;
  idempotencyKey: string;
  emailHash: string;
  vaultRef: string;
  text: string;
  aiGenerated: boolean;
  lane: Lane;
  state: OutboxState;
  scheduledAtMs: number;
  createdAtMs: number;
}
