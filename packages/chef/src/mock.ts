// Deterministic, keyless stand-in for a real LLM. Real providers implement the same ContentProvider.
import type { ContentProvider, GenerationRequest } from './types.ts';
import type { DraftPost } from '../../core/src/index.ts';
import { TweetType } from '../../core/src/index.ts';

function composeText(req: GenerationRequest): string {
  const topic = req.category.trim();
  const gist = req.brief.trim().replace(/\s+/g, ' ');
  const body = gist.length > 240 ? `${gist.slice(0, 237)}...` : gist;
  return req.type === TweetType.ESSAY ? `On ${topic}. ${body}` : `${topic}: ${body}`;
}

export class MockContentProvider implements ContentProvider {
  async generate(req: GenerationRequest): Promise<DraftPost> {
    // A SPAMTEST marker in the brief lets tests exercise the "generated content gets blocked" path.
    const risky = /SPAMTEST/.test(req.brief);
    const text = risky
      ? 'RT if you agree!!!! 🚀🚀🚀🚀🚀🚀🚀 follow for follow #a #b #c #d #e #f'
      : composeText(req);
    return {
      text,
      type: req.type,
      hasLink: false,
      aiGenerated: true,
      hashtags: req.tags.slice(0, 2).map((t) => `#${t.replace(/[^a-z0-9]/gi, '')}`),
      loopId: req.loopId,
      styleSources: req.styleSources.slice(0, 3),
    };
  }
}
