// PKCE + CSRF-state primitives (RFC 7636). The verifier is generated and kept SERVER-SIDE (in the
// pending row); only the S256 challenge ever travels to X. This is the hosted-callback shape (§5.7):
// no loopback, no pinned port, no on-device token — consent works from any browser on any device.
import { createHash, randomBytes } from 'node:crypto';

/** RFC 7636 code_verifier: 43-char base64url (32 random bytes). */
export function generateVerifier(): string {
  return randomBytes(32).toString('base64url');
}

/** S256 code_challenge = base64url(sha256(verifier)). */
export function challengeS256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/** Opaque CSRF/correlation state (also the pending-connection id). */
export function generateState(): string {
  return randomBytes(24).toString('base64url');
}

/** A per-connect nonce that ONLY the initiating agent session holds (account-binding confirm). */
export function generateSessionNonce(): string {
  return randomBytes(24).toString('base64url');
}
