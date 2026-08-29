// @capx-cafe/platform-client — the ONLY seam the closed monorepo uses to reach the open platform
// (the AGPL Postiz fork). Network-only, arm's-length. A Fake implementation lets the whole
// pipeline build and test with zero external keys.

export interface PublishRequest {
  /** opaque platform channel id owned by the fork (never an OAuth token). */
  channelId: string;
  text: string;
  scheduledAtMs: number;
  aiLabel: boolean;
  /** when set, this post is a reply to that platform post id — the seam for thread reply-chaining. */
  inReplyToId?: string;
  /** already-uploaded platform media ids to attach (Phase 4). casserole never inspects media — the caption
   *  text is guarded, the asset rides along un-inspected; the AI-content label is the skill's responsibility. */
  mediaIds?: string[];
}

export interface PublishResult {
  platformPostId: string;
  scheduledAtMs: number;
}

export interface PlatformClient {
  publish(req: PublishRequest): Promise<PublishResult>;
  /** OPTIONAL read: who authored a platform post. Powers the replies-chain-onto-your-own-posts-only
   *  policy (a reply whose parent we did not send is verified own-authored via one platform read).
   *  null = post not found. Absent => the caller must fail closed on unknown parents. */
  lookupPostAuthor?(channelId: string, postId: string): Promise<{ authorId: string } | null>;
}

/** Test/dev double for the open platform: records calls, returns canned ids. */
export class FakePlatformClient implements PlatformClient {
  calls: PublishRequest[] = [];
  /** seed postId -> authorId to simulate the platform's view of who wrote a post. */
  postAuthors = new Map<string, string>();
  private seq = 0;

  async publish(req: PublishRequest): Promise<PublishResult> {
    this.calls.push(req);
    this.seq += 1;
    return { platformPostId: `fake-post-${this.seq}`, scheduledAtMs: req.scheduledAtMs };
  }

  async lookupPostAuthor(_channelId: string, postId: string): Promise<{ authorId: string } | null> {
    const authorId = this.postAuthors.get(postId);
    return authorId === undefined ? null : { authorId };
  }
}

export * from './http.ts';
export * from './factory.ts';
