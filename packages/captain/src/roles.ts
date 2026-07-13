// capx-captain — role/permission engine. Rank-based so higher roles inherit lower permissions;
// non-hierarchical restrictions (e.g. billing = Owner only) fall out of the minimum-rank table.
import type { Role } from '../../core/src/index.ts';

export const Action = {
  ANALYTICS_VIEW: 'analytics.view',
  POST_COMPOSE: 'post.compose',
  LOOP_CREATE: 'loop.create',
  LOOP_EDIT: 'loop.edit',
  POST_PUBLISH: 'post.publish',
  HANDLE_CONNECT: 'handle.connect',
  MEMBER_INVITE: 'member.invite',
  POST_APPROVE: 'post.approve',
  MEMBER_REMOVE: 'member.remove',
  BILLING_MANAGE: 'billing.manage',
  WORKSPACE_MANAGE: 'workspace.manage',
} as const;
export type Action = (typeof Action)[keyof typeof Action];

const ROLE_RANK: Record<Role, number> = { OWNER: 3, MANAGER: 2, CREATOR: 1, VIEWER: 0 };

const ACTION_MIN_RANK: Record<Action, number> = {
  'analytics.view': 0,
  'post.compose': 1,
  'loop.create': 1,
  'loop.edit': 1,
  'post.publish': 1,
  'handle.connect': 2,
  'member.invite': 2,
  'post.approve': 2,
  'member.remove': 3,
  'billing.manage': 3,
  'workspace.manage': 3,
};

export function can(role: Role, action: Action): boolean {
  return ROLE_RANK[role] >= ACTION_MIN_RANK[action];
}
