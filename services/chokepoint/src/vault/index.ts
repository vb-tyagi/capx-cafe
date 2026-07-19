// The token vault: the ONLY place an X token exists, and the ONLY path from ciphertext to plaintext.
// put() encrypts + persists; getMetadata() reads identity WITHOUT decrypting; withToken() is the
// single plaintext-lifetime boundary (decrypt in-memory, hand to fn, never return/log). See §1/§4.
import { randomUUID } from 'node:crypto';
import type { Lane, AccountStanding, XConnectionRef } from '@capx-cafe/core';
import type { Kms } from './kms.ts';
import { sealToken, openToken, type SealedToken } from './crypto.ts';

export interface VaultRow {
  vaultRef: string;
  emailHash: string;
  xUserId: string;
  username: string;
  lane: Lane;
  standing: AccountStanding;
  /** blue tick + X account creation time, captured at connect; casserole L1 gates Loops on both. */
  verified: boolean;
  createdAtMs: number;
  /** the OAuth client id of the app this connection was made with, so a BYO refresh uses the RIGHT app
   *  (each BYO user registers their own X app). Optional: rows predating this field (legacy live
   *  connections) carry undefined and fall back to the server default client id at refresh time. */
  clientId?: string;
  access: SealedToken;
  refresh: SealedToken;
  refreshRotatedAt: number;
  /** set when a refresh was rejected by X (invalid_grant) — the connection is dead until re-auth. */
  needsReauth: boolean;
}

/** Persistence port for the vault (implemented by InMemoryStore now, PostgresStore at S3/S4). */
export interface VaultStore {
  put(row: VaultRow): Promise<void>;
  getByRef(vaultRef: string): Promise<VaultRow | null>;
  getByEmailHash(emailHash: string): Promise<VaultRow | null>;
  updateTokens(vaultRef: string, access: SealedToken, refresh: SealedToken, rotatedAt: number): Promise<void>;
  markNeedsReauth(vaultRef: string): Promise<void>;
}

export interface ConnectionTokens {
  access: string;
  refresh: string;
}
export interface ConnectMeta {
  emailHash: string;
  xUserId: string;
  username: string;
  lane: Lane;
  standing: AccountStanding;
  verified: boolean;
  createdAtMs: number;
  /** the OAuth client id used for this connection (from the PendingConnection) — persisted so refresh
   *  uses the right app. Optional so legacy call-sites/rows without it still type-check. */
  clientId?: string;
}

export class Vault {
  readonly #store: VaultStore;
  readonly #kms: Kms;
  readonly #now: () => number;

  constructor(store: VaultStore, kms: Kms, now: () => number) {
    this.#store = store;
    this.#kms = kms;
    this.#now = now;
  }

  /** Encrypt + persist a new connection. Returns the opaque server-side vaultRef. */
  async put(meta: ConnectMeta, tokens: ConnectionTokens): Promise<string> {
    const vaultRef = randomUUID();
    const [access, refresh] = await Promise.all([
      sealToken(tokens.access, this.#kms),
      sealToken(tokens.refresh, this.#kms),
    ]);
    await this.#store.put({ vaultRef, ...meta, access, refresh, refreshRotatedAt: this.#now(), needsReauth: false });
    return vaultRef;
  }

  /** Connection METADATA only — never decrypts. Safe to surface to whoami. */
  async getMetadata(vaultRef: string): Promise<XConnectionRef | null> {
    const row = await this.#store.getByRef(vaultRef);
    if (!row) return null;
    return {
      vaultRef: row.vaultRef,
      emailHash: row.emailHash,
      xUserId: row.xUserId,
      username: row.username,
      lane: row.lane,
      standing: row.standing,
      verified: row.verified,
      createdAtMs: row.createdAtMs,
    };
  }

  /** Resolve a connection server-side from the session identity (email-hash), never client input. */
  async refByEmailHash(emailHash: string): Promise<string | null> {
    const row = await this.#store.getByEmailHash(emailHash);
    return row ? row.vaultRef : null;
  }

  /**
   * The OAuth app coordinates the Refresher needs to refresh THIS connection: the per-connection client
   * id (BYO users each register their own app) and the lane (only CAPX_APP is a confidential client that
   * uses the server-held secret). Never a token — safe to read outside withToken. clientId is undefined
   * for rows predating the field; the Refresher falls back to the server default there.
   */
  async connectionApp(vaultRef: string): Promise<{ clientId?: string; lane: Lane } | null> {
    const row = await this.#store.getByRef(vaultRef);
    if (!row) return null;
    return { clientId: row.clientId, lane: row.lane };
  }

  /**
   * The ONLY path from a stored token to plaintext. Decrypts the access token in memory, passes it
   * to fn, and NEVER returns or logs it. Plaintext lifetime = the fn call.
   */
  async withToken<T>(vaultRef: string, fn: (accessToken: string) => Promise<T>): Promise<T> {
    const row = await this.#store.getByRef(vaultRef);
    if (!row) throw new Error(`vault: no connection for ref ${vaultRef}`);
    const access = await openToken(row.access, this.#kms);
    return fn(access);
  }

  /** Rotate tokens after an OAuth refresh. The store commit is the atomic crash-consistency point. */
  async rotate(vaultRef: string, tokens: ConnectionTokens): Promise<void> {
    const [access, refresh] = await Promise.all([
      sealToken(tokens.access, this.#kms),
      sealToken(tokens.refresh, this.#kms),
    ]);
    await this.#store.updateTokens(vaultRef, access, refresh, this.#now());
  }

  /** True when the connection has been flagged dead (refresh rejected) and must be re-authorized. */
  async needsReauth(vaultRef: string): Promise<boolean> {
    const row = await this.#store.getByRef(vaultRef);
    return row ? row.needsReauth : false;
  }

  /** Flag the connection dead (invalid_grant) — surfaced to the user as needs-reauth, never silent. */
  async markNeedsReauth(vaultRef: string): Promise<void> {
    await this.#store.markNeedsReauth(vaultRef);
  }

  /** Like withToken, but for the refresh token (used only by the Refresher, serialized per handle). */
  async withRefreshToken<T>(vaultRef: string, fn: (refreshToken: string) => Promise<T>): Promise<T> {
    const row = await this.#store.getByRef(vaultRef);
    if (!row) throw new Error(`vault: no connection for ref ${vaultRef}`);
    const refresh = await openToken(row.refresh, this.#kms);
    return fn(refresh);
  }
}
