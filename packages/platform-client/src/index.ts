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
}

export interface PublishResult {
  platformPostId: string;
  scheduledAtMs: number;
}

export interface PlatformClient {
  publish(req: PublishRequest): Promise<PublishResult>;
}

/** Test/dev double for the open platform: records calls, returns canned ids. */
export class FakePlatformClient implements PlatformClient {
  calls: PublishRequest[] = [];
  private seq = 0;

  async publish(req: PublishRequest): Promise<PublishResult> {
    this.calls.push(req);
    this.seq += 1;
    return { platformPostId: `fake-post-${this.seq}`, scheduledAtMs: req.scheduledAtMs };
  }
}

export * from './http.ts';
export * from './factory.ts';
