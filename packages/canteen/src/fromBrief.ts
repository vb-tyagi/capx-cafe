// capx-canteen — the FULL Loop tick from a brief: capx-chef → capx-casserole → capx-counter → capx-cafe.
import type { GauntletContext } from '@capx-cafe/casserole';
import type { CreditLedger } from '@capx-cafe/counter';
import type { PlatformClient } from '@capx-cafe/platform-client';
import type { ContentProvider, GenerationRequest } from '@capx-cafe/chef';
import { runGeneration } from '@capx-cafe/chef';
import type { DraftPost } from '@capx-cafe/core';
import { runLoopTick } from './orchestrator.ts';
import type { LoopRunResult } from './orchestrator.ts';

export type LoopFromBriefResult =
  | { stage: 'generation'; ok: false; problems: string[] }
  | { stage: 'pipeline'; draft: DraftPost; result: LoopRunResult };

export async function runLoopFromBrief(
  genReq: GenerationRequest,
  ctx: GauntletContext,
  ledger: CreditLedger,
  client: PlatformClient,
  provider: ContentProvider,
): Promise<LoopFromBriefResult> {
  const gen = await runGeneration(provider, genReq);
  if (!gen.ok) return { stage: 'generation', ok: false, problems: gen.problems };
  const result = await runLoopTick(gen.draft, ctx, ledger, client);
  return { stage: 'pipeline', draft: gen.draft, result };
}
