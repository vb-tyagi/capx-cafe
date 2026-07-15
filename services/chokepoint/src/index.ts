// @capx/chokepoint — the thin, stateless, self-hostable hosted chokepoint (Option B).
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
export * from './oauth/pkce.ts';
export * from './oauth/index.ts';
export * from './oauth/refresh.ts';
export * from './xclient/index.ts';
export * from './gate/index.ts';
export * from './gate/draft.ts';
export * from './server/router.ts';
export * from './server/http.ts';

import { InMemoryStore } from './store/memory.ts';
import { LocalKeyKms } from './vault/kms.ts';
import { Vault } from './vault/index.ts';
import { HmacSessionSigner } from './admission/session.ts';
import { Admission } from './admission/index.ts';
import { OAuthFlow, type OAuthConfig, type TokenExchange, type IdentityFetch } from './oauth/index.ts';
import { Refresher } from './oauth/refresh.ts';
import { XAdapter, type XPoster } from './xclient/index.ts';
import { PublishGate } from './gate/index.ts';
import { createService } from './server/router.ts';

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
  now?: () => number;
}

/** Composition root: build the full service over the in-memory store. Deterministic when `now` is set. */
export function createInMemoryChokepoint(cfg: ChokepointConfig) {
  const store = new InMemoryStore();
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
  const gate = new PublishGate({ admission, vault, client: new XAdapter({ vault, post: cfg.xPost }), now });
  const refresher = new Refresher({ vault, clientId: cfg.byoDefaultClientId ?? '' });
  const service = createService({
    admission,
    vault,
    oauth,
    gate,
    adminKey: cfg.adminKey,
    now,
    tokenExchange: cfg.tokenExchange,
    identity: cfg.identity,
    byoDefaultClientId: cfg.byoDefaultClientId,
  });
  return { service, store, vault, admission, oauth, gate, refresher };
}
