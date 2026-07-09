// Dependency-free text similarity + tokenisation used by the anti-slop layers.
// A `SimilarityProvider` seam lets a real embedding model replace the heuristic later.

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s#@]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(' ') : [];
}

export function charTrigrams(text: string): string[] {
  const n = normalize(text);
  const s = ` ${n} `;
  const grams: string[] = [];
  for (let i = 0; i < s.length - 2; i++) grams.push(s.slice(i, i + 3));
  return grams;
}

export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function cosineTrigram(a: string, b: string): number {
  const fa = new Map<string, number>();
  const fb = new Map<string, number>();
  for (const g of charTrigrams(a)) fa.set(g, (fa.get(g) ?? 0) + 1);
  for (const g of charTrigrams(b)) fb.set(g, (fb.get(g) ?? 0) + 1);
  let dot = 0;
  for (const [g, v] of fa) {
    const w = fb.get(g);
    if (w !== undefined) dot += v * w;
  }
  let na = 0;
  let nb = 0;
  for (const v of fa.values()) na += v * v;
  for (const v of fb.values()) nb += v * v;
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Similarity in [0,1]: max of token Jaccard and character-trigram cosine. */
export function similarity(a: string, b: string): number {
  return Math.max(jaccard(tokens(a), tokens(b)), cosineTrigram(a, b));
}

export interface SimilarityProvider {
  similarity(a: string, b: string): number;
}

export const heuristicSimilarity: SimilarityProvider = { similarity };
