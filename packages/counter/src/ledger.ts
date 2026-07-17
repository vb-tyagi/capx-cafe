// @capx/credits — the credit ledger. Pure, deterministic (caller supplies timestamps).

import type { ActionType, Tier } from '@capx/core';
import { preflightCost } from './costModel.ts';
import type { CostBreakdown } from './costModel.ts';

export interface LedgerEntry {
  at: number; // epoch ms
  kind: 'charge' | 'grant' | 'topup';
  action?: ActionType;
  credits: number; // negative for charge, positive for grant/topup
  balanceAfter: number;
  note?: string;
}

export class InsufficientCreditsError extends Error {
  required: number;
  available: number;
  constructor(required: number, available: number) {
    super(`Insufficient credits: need ${required}, have ${available}`);
    this.name = 'InsufficientCreditsError';
    this.required = required;
    this.available = available;
  }
}

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

export class CreditLedger {
  private balance: number;
  private tier: Tier;
  private entries: LedgerEntry[] = [];
  /** resourceKey -> last-charged epoch ms, mirrors the X API "same resource in 24h charged once" rule. */
  private readReceipts = new Map<string, number>();

  constructor(tier: Tier, startingCredits: number) {
    this.tier = tier;
    this.balance = startingCredits;
  }

  getBalance(): number {
    return this.balance;
  }

  getEntries(): readonly LedgerEntry[] {
    return this.entries;
  }

  quote(action: ActionType): CostBreakdown {
    return preflightCost(action, this.tier);
  }

  canAfford(action: ActionType): boolean {
    return this.balance >= this.quote(action).credits;
  }

  charge(action: ActionType, at: number, note?: string): LedgerEntry {
    const cost = this.quote(action).credits;
    if (this.balance < cost) throw new InsufficientCreditsError(cost, this.balance);
    this.balance -= cost;
    const entry: LedgerEntry = { at, kind: 'charge', action, credits: -cost, balanceAfter: this.balance, note };
    this.entries.push(entry);
    return entry;
  }

  /** Dedup-aware read: the same resource within 24h is free (returns null, no charge). */
  chargeRead(resourceKey: string, at: number): LedgerEntry | null {
    const last = this.readReceipts.get(resourceKey);
    if (last !== undefined && at - last < DEDUP_WINDOW_MS) return null;
    const entry = this.charge('READ', at, `read:${resourceKey}`);
    this.readReceipts.set(resourceKey, at);
    return entry;
  }

  grant(credits: number, at: number, note = 'grant'): LedgerEntry {
    this.balance += credits;
    const entry: LedgerEntry = { at, kind: 'grant', credits, balanceAfter: this.balance, note };
    this.entries.push(entry);
    return entry;
  }

  topUp(credits: number, at: number, note = 'top-up'): LedgerEntry {
    this.balance += credits;
    const entry: LedgerEntry = { at, kind: 'topup', credits, balanceAfter: this.balance, note };
    this.entries.push(entry);
    return entry;
  }
}
