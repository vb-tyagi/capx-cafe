// @capx-cafe/chokepoint — the thin, stateless, self-hostable hosted chokepoint (Option B).
// Public surface + a composition root. The whole service runs over the InMemoryStore driver (no DB
// needed to boot for dev / self-host evaluation); the PostgresStore driver swaps in at the port with
// zero code change above it. Real X integration (token exchange / identity / poster) is INJECTED, so
// nothing here hard-depends on network — dev wires mocks, prod wires the real X endpoints.
export * from './vault/kms.ts';
export * from './vault/crypto.ts';
export * from './vault/index.ts';
export * from './store/memory.ts';
export * from './admission/session.ts';
export * from './admission/index.ts';
export * from './outbox/mutex.ts';
export * from './outbox/index.ts';
export * from './metering/index.ts';
export * from './recent/index.ts';
export * from './loops/index.ts';
export * from './oauth/pkce.ts';
export * from './oauth/index.ts';
export * from './oauth/refresh.ts';
export * from './xclient/index.ts';
export * from './xclient/x-api.ts';
export * from './gate/index.ts';
export * from './gate/draft.ts';
export * from './server/router.ts';
export * from './server/http.ts';
export * from './store/postgres.ts'; // pg-free driver (SqlPool only); real pool factory is ./store/pg-pool.ts

import { InMemoryStore } from './store/memory.ts';
import { LocalKeyKms } from './vault/kms.ts';
import { Vault } from './vault/index.ts';
import type { VaultStore } from './vault/index.ts';
import { HmacSessionSigner } from './admission/session.ts';
import { Admission } from './admission/index.ts';
import type { AdmissionStore } from './admission/index.ts';
import { OAuthFlow, type OAuthConfig, type TokenExchange, type IdentityFetch } from './oauth/index.ts';
import type { PendingStore } from './oauth/index.ts';
import { Refresher } from './oauth/refresh.ts';
import { XAdapter, type XPoster } from './xclient/index.ts';
import { PublishGate } from './gate/index.ts';
import { Metering } from './metering/index.ts';
import type { MeteringStore } from './metering/index.ts';
import { RecentPosts } from './recent/index.ts';
import type { RecentPostStore } from './recent/index.ts';
import { Outbox } from './outbox/index.ts';
import type { OutboxStore } from './outbox/index.ts';
import { Loops } from './loops/index.ts';
import type { LoopStore } from './loops/index.ts';
import { LoopTicker } from './loops/tick.ts';
import { createService } from './server/router.ts';

/** A store implementing every chokepoint port (InMemoryStore and PostgresStore both satisfy it). */
export type ChokepointStore = VaultStore &
  AdmissionStore &
  OutboxStore &
  PendingStore &
  MeteringStore &
  RecentPostStore &
  LoopStore;

export interface ChokepointConfig {
  masterKeyBase64: string; // KMS_KEY_ID
  signingKey: string; // SESSION_SIGNING_KEY
  adminKey: string;
  sessionTtlMs?: number;
  sessionGraceMs?: number;
  oauth: OAuthConfig;
  tokenExchange: TokenExchange;
  identity: IdentityFetch;
  xPost: XPoster;
  byoDefaultClientId?: string;
  /** lane-B (capx-app) per-day post cap; omit to leave the capx-app lane uncapped. */
  capxAppDailyCap?: number;
  now?: () => number;
}

/**
 * Composition root — build the full service over ANY store (the InMemory or Postgres driver, or any
 * other ChokepointStore). Everything above the port is identical; the store is the only swap. Real X
 * integration stays injected. Deterministic when `now` is set.
 */
export function createChokepoint(store: ChokepointStore, cfg: ChokepointConfig) {
  const kms = new LocalKeyKms(cfg.masterKeyBase64);
  const now = cfg.now ?? (() => Date.now());
  const vault = new Vault(store, kms, now);
  const signer = new HmacSessionSigner(
    cfg.signingKey,
    cfg.sessionTtlMs ?? 15 * 60_000,
    cfg.sessionGraceMs ?? 12 * 60 * 60_000,
  );
  const admission = new Admission(store, signer);
  const oauth = new OAuthFlow(store, cfg.oauth);
  const metering = cfg.capxAppDailyCap !== undefined ? new Metering(store, cfg.capxAppDailyCap) : undefined;
  const recentPosts = new RecentPosts(store);
  const outbox = new Outbox(store);
  const loops = new Loops(store, now);
  const gate = new PublishGate({ admission, vault, client: new XAdapter({ vault, post: cfg.xPost }), now, metering, recentPosts, outbox });
  const refresher = new Refresher({ vault, clientId: cfg.byoDefaultClientId ?? '' });
  const ticker = new LoopTicker({ loops, gate, now });
  const service = createService({
    admission,
    vault,
    oauth,
    gate,
    loops,
    ticker,
    adminKey: cfg.adminKey,
    now,
    tokenExchange: cfg.tokenExchange,
    identity: cfg.identity,
    callbackUrl: cfg.oauth.redirectUri,
    byoDefaultClientId: cfg.byoDefaultClientId,
  });
  return { service, store, vault, admission, oauth, gate, refresher, loops, ticker };
}

/** Build the service over the in-memory store (dev / tests / self-host evaluation — no DB). */
export function createInMemoryChokepoint(cfg: ChokepointConfig) {
  const store = new InMemoryStore();
  return { ...createChokepoint(store, cfg), store };
}
