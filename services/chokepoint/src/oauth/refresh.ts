// Crash-consistent refresh-token rotation. X rotates the refresh token on every use (one-time), so
// two concurrent refreshes would double-spend the same token and brick the connection (§3). We:
//   - serialize per connection (KeyedMutex keyed by vaultRef) so only one refresh runs at a time;
//   - on invalid_grant (X rejected the stored refresh) mark the connection needs-reauth, never leave
//     a silently-dead connection;
//   - treat rotate() (the store commit) as the atomic point: a crash BEFORE commit leaves the old
//     tokens, so the next refresh invalid_grants -> needs-reauth (surfaced honestly, not a silent brick).
import type { Vault } from '../vault/index.ts';
import { KeyedMutex } from '../outbox/mutex.ts';

export type RefreshExchange = (p: {
  refreshToken: string;
  clientId: string;
  clientSecret?: string;
}) => Promise<{ accessToken: string; refreshToken: string }>;

export type RefreshResult = { ok: true } | { ok: false; needsReauth: true; reason: string };

export interface RefresherDeps {
  vault: Vault;
  clientId: string;
  clientSecret?: string;
  mutex?: KeyedMutex;
}

export class Refresher {
  readonly #vault: Vault;
  readonly #clientId: string;
  readonly #clientSecret?: string;
  readonly #mutex: KeyedMutex;

  constructor(deps: RefresherDeps) {
    this.#vault = deps.vault;
    this.#clientId = deps.clientId;
    this.#clientSecret = deps.clientSecret;
    this.#mutex = deps.mutex ?? new KeyedMutex();
  }

  async refresh(vaultRef: string, exchange: RefreshExchange): Promise<RefreshResult> {
    return this.#mutex.run(vaultRef, async () => {
      if (await this.#vault.needsReauth(vaultRef)) {
        return { ok: false, needsReauth: true, reason: 'connection already flagged needs-reauth' };
      }
      let next: { accessToken: string; refreshToken: string };
      try {
        next = await this.#vault.withRefreshToken(vaultRef, (rt) =>
          exchange({ refreshToken: rt, clientId: this.#clientId, clientSecret: this.#clientSecret }),
        );
      } catch (e) {
        await this.#vault.markNeedsReauth(vaultRef);
        return { ok: false, needsReauth: true, reason: e instanceof Error ? e.message : 'refresh failed' };
      }
      await this.#vault.rotate(vaultRef, { access: next.accessToken, refresh: next.refreshToken });
      return { ok: true };
    });
  }
}
