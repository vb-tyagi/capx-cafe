// capx-chef — AI content generation. The ContentProvider abstraction lets a mock (keyless) and,
// later, real LLM/image providers implement the same seam. chef returns a DraftPost that flows
// straight into capx-canteen -> capx-casserole.
import type { TweetType } from '@capx/core';

export interface GenerationRequest {
  type: TweetType;
  /** short topic label the post should talk about */
  category: string;
  /** < ~500 words describing what the post should say */
  brief: string;
  tags: string[];
  /** up to 3 handles for STYLE CALIBRATION (never verbatim cloning) */
  styleSources: string[];
  model: string;
  handleId: string;
  loopId?: string;
}

export interface ContentProvider {
  generate(req: GenerationRequest): Promise<import('@capx/core').DraftPost>;
}
