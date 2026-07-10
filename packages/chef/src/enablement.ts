// capx-chef's OWN guardrails — INPUT-side validation of the generation request (distinct from
// capx-casserole, which guards the OUTPUT). Keeps briefs sane and style-sources within limits.
import type { GenerationRequest } from './types.ts';

export const MAX_BRIEF_CHARS = 3000; // ~500 words
export const MAX_STYLE_SOURCES = 3;
export const MAX_TAGS = 10;

export interface RequestValidation {
  ok: boolean;
  problems: string[];
}

export function validateRequest(req: GenerationRequest): RequestValidation {
  const problems: string[] = [];
  if (req.brief.trim().length === 0) problems.push('brief is empty');
  if (req.brief.length > MAX_BRIEF_CHARS) problems.push(`brief too long (${req.brief.length}/${MAX_BRIEF_CHARS} chars)`);
  if (req.category.trim().length === 0) problems.push('category is required');
  if (req.styleSources.length > MAX_STYLE_SOURCES) problems.push(`too many style sources (${req.styleSources.length}/${MAX_STYLE_SOURCES})`);
  if (req.tags.length > MAX_TAGS) problems.push(`too many tags (${req.tags.length}/${MAX_TAGS})`);
  return { ok: problems.length === 0, problems };
}
