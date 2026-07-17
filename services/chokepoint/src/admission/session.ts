// Short-TTL session handles the agent-co-resident MCP server holds — NOT X tokens. A signed bearer
// `base64url(payload).hmac`; the chokepoint validates the signature + expiry (+ cached grace window).
// Only a SESSION_SIGNING_KEY holder can mint one; theft yields at most gated, kill-switch-bounded posting.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SessionHandle, SessionValidation } from '@capx-cafe/core';

const b64url = (s: string): string => Buffer.from(s, 'utf8').toString('base64url');
const unb64url = (s: string): string => Buffer.from(s, 'base64url').toString('utf8');

export class HmacSessionSigner {
  readonly #key: string;
  readonly #ttlMs: number;
  readonly #graceMs: number;

  constructor(signingKey: string, ttlMs: number, graceMs: number) {
    this.#key = signingKey;
    this.#ttlMs = ttlMs;
    this.#graceMs = graceMs;
  }

  #sign(body: string): string {
    return createHmac('sha256', this.#key).update(body).digest('hex');
  }

  issue(emailHash: string, now: number): string {
    const payload: SessionHandle = { emailHash, issuedAt: now, expiresAt: now + this.#ttlMs };
    const body = b64url(JSON.stringify(payload));
    return `${body}.${this.#sign(body)}`;
  }

  /** null iff the signature is invalid/absent. Otherwise reports valid / in-grace against `now`. */
  verify(bearer: string, now: number): { handle: SessionHandle; validation: SessionValidation } | null {
    const dot = bearer.lastIndexOf('.');
    if (dot < 0) return null;
    const body = bearer.slice(0, dot);
    const sig = Buffer.from(bearer.slice(dot + 1));
    const expected = Buffer.from(this.#sign(body));
    if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
    let handle: SessionHandle;
    try {
      handle = JSON.parse(unb64url(body)) as SessionHandle;
    } catch {
      return null;
    }
    const valid = now <= handle.expiresAt;
    const inGrace = !valid && now <= handle.expiresAt + this.#graceMs;
    return { handle, validation: { valid, inGrace, expiresAt: handle.expiresAt } };
  }
}
