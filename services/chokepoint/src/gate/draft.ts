// Build the casserole-ready DraftPost from agent-authored text (post_now publishes the agent's own
// text; the host agent IS the LLM). Sets a REAL hasLink (URL regex), honest aiGenerated, type=TEXT,
// and an X weighted-length preflight (casserole has no length check). See §6 fix #13.
import type { DraftPost } from '@capx-cafe/core';
import { TweetType } from '@capx-cafe/core';

const URL_G = /\bhttps?:\/\/\S+/gi; // global — for counting/removing
const URL_TEST = /\bhttps?:\/\/\S+/i; // non-global — for a stateless hasLink test
const TCO_LEN = 23; // X normalizes every URL to a t.co of this fixed weight
const MAX_WEIGHTED = 280;

/** X-style weighted length: every URL counts as 23; the rest by code points (CJK x2 not modeled in P1). */
export function weightedLength(text: string): number {
  const urlCount = (text.match(URL_G) ?? []).length;
  const nonUrl = [...text.replace(URL_G, '')].length; // code points, not UTF-16 units
  return nonUrl + urlCount * TCO_LEN;
}

export interface NormalizedDraft {
  draft: DraftPost;
  problems: string[];
}

export function normalizeDraft(text: string, opts: { aiGenerated: boolean }): NormalizedDraft {
  const problems: string[] = [];
  if (text.trim().length === 0) problems.push('post text is empty');
  const wl = weightedLength(text);
  if (wl > MAX_WEIGHTED) {
    problems.push(`post exceeds ${MAX_WEIGHTED} chars (weighted length ${wl}; each URL counts as ${TCO_LEN})`);
  }
  const draft: DraftPost = {
    text,
    type: TweetType.TEXT,
    hasLink: URL_TEST.test(text),
    aiGenerated: opts.aiGenerated,
    hashtags: (text.match(/#\w+/g) ?? []).map((h) => h.slice(1)),
    styleSources: [],
  };
  return { draft, problems };
}
