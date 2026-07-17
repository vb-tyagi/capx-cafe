// capx-captain — the gate on every request: kill switch → whitelist → membership → role → (handle cap).
// Returns a tenantScope used to scope Postgres RLS (`set_config('app.workspace_id', tenantScope)`).
import type { Role, Tier } from '@capx/core';
import { can, Action } from './roles.ts';
import { isWhitelisted } from './whitelist.ts';
import type { VerificationStatus } from './whitelist.ts';
import { resolveKillSwitch } from './killswitch.ts';
import type { KillSwitchRegistry } from './killswitch.ts';
import { canAddHandle } from './handles.ts';

export interface Membership {
  userId: string;
  workspaceId: string;
  role: Role;
}

export interface GateRequest {
  userId: string;
  workspaceId: string;
  handleId?: string;
  action: Action;
  memberships: Membership[];
  verification: VerificationStatus;
  killSwitch?: KillSwitchRegistry;
  /** required when action === 'handle.connect' */
  tier?: Tier;
  currentHandleCount?: number;
}

export interface GateDecision {
  allowed: boolean;
  reason?: string;
  role?: Role;
  /** value for Postgres RLS `app.workspace_id` when allowed */
  tenantScope?: string;
}

export function resolveMembership(
  memberships: Membership[],
  userId: string,
  workspaceId: string,
): Membership | undefined {
  return memberships.find((m) => m.userId === userId && m.workspaceId === workspaceId);
}

export function gateRequest(req: GateRequest): GateDecision {
  const ks = req.killSwitch
    ? resolveKillSwitch(req.killSwitch, req.workspaceId, req.handleId)
    : { global: false, handle: false };

  if (ks.global) return { allowed: false, reason: 'global kill switch active' };
  if (!isWhitelisted(req.verification)) return { allowed: false, reason: 'identity not verified (Medium gate)' };

  const member = resolveMembership(req.memberships, req.userId, req.workspaceId);
  if (!member) return { allowed: false, reason: 'no membership in workspace' };
  if (ks.handle) return { allowed: false, reason: 'kill switch active for this workspace/handle', role: member.role };

  if (!can(member.role, req.action)) {
    return { allowed: false, reason: `role ${member.role} cannot ${req.action}`, role: member.role };
  }

  if (req.action === Action.HANDLE_CONNECT) {
    if (req.tier === undefined || req.currentHandleCount === undefined) {
      return { allowed: false, reason: 'handle.connect requires tier + currentHandleCount', role: member.role };
    }
    const cap = canAddHandle(req.currentHandleCount, req.tier);
    if (!cap.allowed) return { allowed: false, reason: cap.reason, role: member.role };
  }

  return { allowed: true, role: member.role, tenantScope: req.workspaceId };
}
