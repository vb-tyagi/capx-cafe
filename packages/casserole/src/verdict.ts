import type { Verdict } from '../../core/src/index.ts';

// Severity ordering: PASS < REGENERATE (auto-retry) < HOLD (human) < BLOCK (drop).
const SEVERITY: Record<Verdict, number> = { PASS: 0, REGENERATE: 1, HOLD: 2, BLOCK: 3 };

export function severity(v: Verdict): number {
  return SEVERITY[v];
}

/** Returns the more restrictive of two verdicts. */
export function worst(a: Verdict, b: Verdict): Verdict {
  return severity(a) >= severity(b) ? a : b;
}
