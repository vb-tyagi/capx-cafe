// capx-chef entrypoint: validate the request (chef's input guardrails), then generate.
import type { ContentProvider, GenerationRequest } from './types.ts';
import type { DraftPost } from '@capx-cafe/core';
import { validateRequest } from './enablement.ts';

export type GenerationResult = { ok: true; draft: DraftPost } | { ok: false; problems: string[] };

export async function runGeneration(provider: ContentProvider, req: GenerationRequest): Promise<GenerationResult> {
  const check = validateRequest(req);
  if (!check.ok) return { ok: false, problems: check.problems };
  const draft = await provider.generate(req);
  return { ok: true, draft };
}
