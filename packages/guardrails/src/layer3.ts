// L3 — Anti-slop quality. Duplication, slop-scoring, banned patterns, AI-image bar, factuality flag.
import type { LayerResult, GauntletContext } from './types.ts';
import type { DraftPost } from '../../core/src/index.ts';
import { GuardrailLayer, Verdict, TweetType } from '../../core/src/index.ts';
import { similarity } from './text.ts';
import { worst } from './verdict.ts';

const ENGAGEMENT_BAIT: RegExp[] = [
  /\brt if\b/i,
  /\blike if\b/i,
  /\bcomment (below|your|with)\b/i,
  /\btag (someone|a friend|3|your)\b/i,
  /\bwho else\b/i,
  /\bam i the only one\b/i,
  /\bfollow (for|back)\b/i,
  /\bretweet (to|if)\b/i,
  /\bdrop a .{1,10} below\b/i,
];
const FAKE_URGENCY: RegExp[] = [
  /\bact now\b/i,
  /\blimited time\b/i,
  /\bdon'?t miss\b/i,
  /\blast chance\b/i,
  /\bhurry\b/i,
  /\bonly \d+ (spots|left)\b/i,
  /\bending soon\b/i,
];
const GENERIC_FILLER: RegExp[] = [
  /\bgame ?changer\b/i,
  /\blet that sink in\b/i,
  /\bthis is huge\b/i,
  /\bthe future is here\b/i,
  /\bunpopular opinion\b/i,
  /\bmind ?blown\b/i,
  /\bhot take\b/i,
  /\bchanges everything\b/i,
  /\bneedle[- ]moving\b/i,
  /\bbreaking the internet\b/i,
];
const FACTUAL_CLAIM: RegExp[] = [
  /\bstudies show\b/i,
  /\b\d{2,3}% of\b/i,
  /\bscientifically proven\b/i,
  /\bclinically proven\b/i,
  /\bguaranteed\b/i,
  /\bdoctors recommend\b/i,
  /\bproven to\b/i,
];

export interface SlopScore {
  score: number; // 0 (clean) .. 1 (slop)
  reasons: string[];
}

export function computeSlopScore(post: DraftPost): SlopScore {
  const t = post.text ?? '';
  const trimmed = t.trim();
  if (trimmed.length === 0) return { score: 1, reasons: ['empty text'] };

  const reasons: string[] = [];
  let score = 0;
  const add = (w: number, why: string): void => {
    score += w;
    reasons.push(why);
  };

  if (post.type !== TweetType.ESSAY && trimmed.length < 15) add(0.35, 'too short / low-substance');

  for (const re of ENGAGEMENT_BAIT) if (re.test(t)) { add(0.4, 'engagement-bait phrasing'); break; }
  for (const re of FAKE_URGENCY) if (re.test(t)) { add(0.35, 'fake urgency'); break; }

  let filler = 0;
  for (const re of GENERIC_FILLER) if (re.test(t)) filler++;
  if (filler > 0) add(Math.min(0.4, 0.2 * filler), `generic filler x${filler}`);

  const hashtags = (t.match(/#\w+/g) ?? []).length;
  if (hashtags > 5) add(0.4, `hashtag stuffing (${hashtags})`);
  else if (hashtags > 3) add(0.2, `too many hashtags (${hashtags})`);

  const links = (t.match(/https?:\/\/\S+/g) ?? []).length;
  if (links > 1) add(0.3, `multiple links (${links})`);

  const letters = t.replace(/[^a-zA-Z]/g, '');
  if (letters.length >= 12) {
    const caps = (t.match(/[A-Z]/g) ?? []).length / letters.length;
    if (caps > 0.6) add(0.3, 'excessive ALL-CAPS');
  }

  if ((t.match(/!/g) ?? []).length >= 4) add(0.2, 'exclamation spam');

  const emojis = (t.match(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? []).length;
  if (emojis > 6) add(0.25, `emoji spam (${emojis})`);

  return { score: Math.min(1, score), reasons };
}

export function layer3Quality(ctx: GauntletContext, post: DraftPost): LayerResult {
  const layer = GuardrailLayer.L3_QUALITY;
  const reasons: string[] = [];
  let verdict: Verdict = Verdict.PASS;
  const escalate = (v: Verdict): void => {
    verdict = worst(verdict, v);
  };

  // hard banned pattern
  const hashtags = (post.text.match(/#\w+/g) ?? []).length;
  if (hashtags > 8) {
    reasons.push(`hashtag stuffing (${hashtags}) — hard block`);
    escalate(Verdict.BLOCK);
  }

  // duplication vs recent account history
  let maxSim = 0;
  for (const h of ctx.history) {
    const s = similarity(post.text, h.text);
    if (s > maxSim) maxSim = s;
  }
  if (maxSim >= 0.85) {
    reasons.push(`near-duplicate of a recent post (sim=${maxSim.toFixed(2)})`);
    escalate(Verdict.BLOCK);
  } else if (maxSim >= 0.7) {
    reasons.push(`too similar to a recent post (sim=${maxSim.toFixed(2)}) — regenerate`);
    escalate(Verdict.REGENERATE);
  }

  // slop score
  const slop = computeSlopScore(post);
  if (slop.score >= 0.8) {
    reasons.push(`high slop score ${slop.score.toFixed(2)}: ${slop.reasons.join('; ')}`);
    escalate(Verdict.BLOCK);
  } else if (slop.score >= 0.5) {
    reasons.push(`elevated slop score ${slop.score.toFixed(2)}: ${slop.reasons.join('; ')}`);
    escalate(Verdict.REGENERATE);
  } else if (slop.reasons.length) {
    reasons.push(`minor slop signals: ${slop.reasons.join('; ')}`);
  }

  // higher bar for AI images
  if (post.type === TweetType.GRAPHIC && post.aiGenerated) {
    reasons.push('AI graphic — requires human review (higher bar)');
    escalate(Verdict.HOLD);
  }

  // factuality flag
  for (const re of FACTUAL_CLAIM) {
    if (re.test(post.text)) {
      reasons.push('unverified factual claim — flag for review');
      escalate(Verdict.HOLD);
      break;
    }
  }

  return { layer, verdict, reasons, data: { slopScore: slop.score, maxSimilarity: maxSim } };
}
