// capx-captain — invite-only whitelist + the Medium identity gate.
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type InviteStatus = 'pending' | 'accepted' | 'revoked';

export interface Invite {
  code: string;
  email: string;
  workspaceId: string;
  status: InviteStatus;
}

/** Medium gate: a real, verified person/business is on the whitelist. */
export function isWhitelisted(verification: VerificationStatus): boolean {
  return verification === 'verified';
}

export interface AcceptInviteResult {
  ok: boolean;
  reason?: string;
  invite?: Invite;
}

export function acceptInvite(invite: Invite, email: string, verification: VerificationStatus): AcceptInviteResult {
  if (invite.status === 'revoked') return { ok: false, reason: 'invite revoked' };
  if (invite.status === 'accepted') return { ok: false, reason: 'invite already used' };
  if (invite.email.toLowerCase() !== email.toLowerCase()) return { ok: false, reason: 'email mismatch' };
  if (!isWhitelisted(verification)) return { ok: false, reason: 'identity not verified (Medium gate)' };
  return { ok: true, invite: { ...invite, status: 'accepted' } };
}
