// Hosted-callback OAuth flow (§5.7). Three steps, deliberately split so the vault write is bound to
// the INITIATING session (account-binding, review fix #3):
//   1. start()          -> build the consent URL (S256 challenge), stash a pending row (verifier +
//                          emailHash + lane + a session-only nonce). Returns the URL + pendingId.
//   2. handleRedirect()  -> X redirects here with (state, code). Validate state/expiry, exchange
//                          code+verifier for tokens, fetch the X identity, mark the pending RESOLVED.
//                          Does NOT touch the vault. Returns the resolved @username for the browser page.
//   3. confirm()        -> the initiating agent session (the only holder of the nonce) confirms the
//                          specific pendingId; only then are the tokens released for the vault write.
// The token exchange + identity lookup are injected (mock X in tests; real X endpoints in prod), so
// this whole module is unit-tested with no network.
import type { Lane } from '@capx/core';
import { challengeS256, generateState, generateVerifier } from './pkce.ts';

export interface ResolvedConnection {
  xUserId: string;
  username: string;
  /** blue tick — casserole L1 gates Loops on it. */
  verified: boolean;
  /** epoch ms the X ACCOUNT was created; casserole L1 gates Loops on age >= 30d. 0 = unknown (fails closed). */
  createdAtMs: number;
  accessToken: string;
  refreshToken: string;
}

export interface PendingConnection {
  pendingId: string; // == state
  verifier: string;
  emailHash: string;
  lane: Lane;
  clientId: string;
  sessionNonce: string;
  createdAt: number;
  expiresAt: number;
  resolved: ResolvedConnection | null;
}

export interface PendingStore {
  putPending(p: PendingConnection): Promise<void>;
  getPending(pendingId: string): Promise<PendingConnection | null>;
  deletePending(pendingId: string): Promise<void>;
}

export type TokenExchange = (p: {
  code: string;
  verifier: string;
  clientId: string;
  clientSecret?: string;
}) => Promise<{ accessToken: string; refreshToken: string }>;

export type IdentityFetch = (
  accessToken: string,
) => Promise<{ xUserId: string; username: string; verified: boolean; createdAtMs: number }>;

export interface OAuthConfig {
  authorizeEndpoint: string;
  redirectUri: string; // the single hosted HTTPS callback (both lanes)
  scope: string;
  ttlMs?: number;
}

export interface StartInput {
  lane: Lane;
  clientId: string;
  emailHash: string;
  sessionNonce: string;
  now: number;
}
export interface StartResult {
  consentUrl: string;
  pendingId: string;
  expiresAt: number;
}

/** The connection released to the server for the vault write, once the session confirms. */
export interface ConfirmedConnection {
  emailHash: string;
  lane: Lane;
  xUserId: string;
  username: string;
  verified: boolean;
  createdAtMs: number;
  accessToken: string;
  refreshToken: string;
}

const DEFAULT_TTL = 10 * 60_000;

export class OAuthFlow {
  readonly #store: PendingStore;
  readonly #cfg: OAuthConfig;
  readonly #ttl: number;

  constructor(store: PendingStore, cfg: OAuthConfig) {
    this.#store = store;
    this.#cfg = cfg;
    this.#ttl = cfg.ttlMs ?? DEFAULT_TTL;
  }

  async start(input: StartInput): Promise<StartResult> {
    const verifier = generateVerifier();
    const state = generateState();
    const expiresAt = input.now + this.#ttl;
    await this.#store.putPending({
      pendingId: state,
      verifier,
      emailHash: input.emailHash,
      lane: input.lane,
      clientId: input.clientId,
      sessionNonce: input.sessionNonce,
      createdAt: input.now,
      expiresAt,
      resolved: null,
    });
    const u = new URL(this.#cfg.authorizeEndpoint);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('client_id', input.clientId);
    u.searchParams.set('redirect_uri', this.#cfg.redirectUri);
    u.searchParams.set('scope', this.#cfg.scope);
    u.searchParams.set('state', state);
    u.searchParams.set('code_challenge', challengeS256(verifier));
    u.searchParams.set('code_challenge_method', 'S256');
    return { consentUrl: u.toString(), pendingId: state, expiresAt };
  }

  /** X's redirect lands here. Validates state, exchanges the code, marks the pending RESOLVED. */
  async handleRedirect(
    input: { state: string; code: string; now: number; clientSecret?: string },
    exchange: TokenExchange,
    identity: IdentityFetch,
  ): Promise<{ username: string }> {
    const pending = await this.#store.getPending(input.state);
    if (!pending) throw new Error('oauth: unknown or already-used state');
    if (input.now > pending.expiresAt) {
      await this.#store.deletePending(input.state);
      throw new Error('oauth: state expired');
    }
    const tokens = await exchange({
      code: input.code,
      verifier: pending.verifier,
      clientId: pending.clientId,
      clientSecret: input.clientSecret,
    });
    const who = await identity(tokens.accessToken);
    const resolved: ResolvedConnection = {
      xUserId: who.xUserId,
      username: who.username,
      verified: who.verified,
      createdAtMs: who.createdAtMs,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
    await this.#store.putPending({ ...pending, resolved });
    return { username: who.username };
  }

  /**
   * The initiating session confirms its pendingId with the session-only nonce; only then are the
   * tokens released (one-time) for the vault write. A relayed consent URL can't be confirmed by a
   * party that didn't start the flow. (Residual victim-consent phishing is a pre-multi-user hardening;
   * P1 is founder-only — see docs/LEGAL-BRIEF.md.)
   */
  async confirm(input: { pendingId: string; sessionNonce: string }): Promise<ConfirmedConnection> {
    const pending = await this.#store.getPending(input.pendingId);
    if (!pending) throw new Error('oauth: unknown or already-used pending');
    if (pending.sessionNonce !== input.sessionNonce) throw new Error('oauth: session mismatch (account-binding)');
    if (!pending.resolved) throw new Error('oauth: consent not completed yet');
    await this.#store.deletePending(input.pendingId); // one-time use
    return {
      emailHash: pending.emailHash,
      lane: pending.lane,
      xUserId: pending.resolved.xUserId,
      username: pending.resolved.username,
      verified: pending.resolved.verified,
      createdAtMs: pending.resolved.createdAtMs,
      accessToken: pending.resolved.accessToken,
      refreshToken: pending.resolved.refreshToken,
    };
  }
}
