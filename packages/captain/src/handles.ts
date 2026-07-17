// capx-captain — the 3-handle cap (min of tier allowance and the hard global cap).
import type { Tier } from '@capx-cafe/core';
import { TIER_LIMITS, HANDLE_CAP } from '@capx-cafe/core';

export interface HandleCapResult {
  allowed: boolean;
  limit: number;
  current: number;
  reason?: string;
}

export function handleLimit(tier: Tier): number {
  return Math.min(TIER_LIMITS[tier].maxHandles, HANDLE_CAP);
}

export function canAddHandle(currentHandleCount: number, tier: Tier): HandleCapResult {
  const limit = handleLimit(tier);
  if (currentHandleCount >= limit) {
    return { allowed: false, limit, current: currentHandleCount, reason: `handle cap reached (${currentHandleCount}/${limit})` };
  }
  return { allowed: true, limit, current: currentHandleCount };
}
