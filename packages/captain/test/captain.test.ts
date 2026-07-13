import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  can,
  Action,
  acceptInvite,
  isWhitelisted,
  canAddHandle,
  handleLimit,
  emptyKillSwitch,
  resolveKillSwitch,
  gateRequest,
} from '../src/index.ts';
import type { Invite, Membership, GateRequest } from '../src/index.ts';

// --- roles ---
test('roles: hierarchy + non-hierarchical restrictions', () => {
  assert.ok(can('OWNER', Action.BILLING_MANAGE));
  assert.ok(!can('MANAGER', Action.BILLING_MANAGE)); // billing = Owner only
  assert.ok(can('MANAGER', Action.HANDLE_CONNECT));
  assert.ok(can('CREATOR', Action.LOOP_CREATE));
  assert.ok(!can('CREATOR', Action.MEMBER_INVITE));
  assert.ok(can('VIEWER', Action.ANALYTICS_VIEW));
  assert.ok(!can('VIEWER', Action.POST_COMPOSE));
});

// --- whitelist / Medium gate ---
const invite = (o: Partial<Invite> = {}): Invite => ({ code: 'c1', email: 'a@b.com', workspaceId: 'w', status: 'pending', ...o });

test('whitelist: accept a valid, verified invite', () => {
  const r = acceptInvite(invite(), 'A@B.com', 'verified');
  assert.ok(r.ok);
  assert.equal(r.invite?.status, 'accepted');
});

test('whitelist: reject revoked / used / mismatched / unverified', () => {
  assert.equal(acceptInvite(invite({ status: 'revoked' }), 'a@b.com', 'verified').ok, false);
  assert.equal(acceptInvite(invite({ status: 'accepted' }), 'a@b.com', 'verified').ok, false);
  assert.equal(acceptInvite(invite(), 'other@b.com', 'verified').ok, false);
  const unverified = acceptInvite(invite(), 'a@b.com', 'pending');
  assert.equal(unverified.ok, false);
  assert.match(unverified.reason ?? '', /Medium gate/);
});

test('isWhitelisted only for verified', () => {
  assert.ok(isWhitelisted('verified'));
  assert.ok(!isWhitelisted('pending'));
  assert.ok(!isWhitelisted('unverified'));
});

// --- 3-handle cap ---
test('handle cap = min(tier allowance, global hard cap)', () => {
  assert.equal(handleLimit('SOLO'), 1);
  assert.equal(handleLimit('TEAM'), 3);
  assert.equal(canAddHandle(3, 'TEAM').allowed, false);
  assert.equal(canAddHandle(2, 'TEAM').allowed, true);
  assert.equal(canAddHandle(1, 'SOLO').allowed, false);
  assert.equal(canAddHandle(0, 'SOLO').allowed, true);
});

// --- kill switch ---
test('kill switch resolves to the casserole { global, handle } shape', () => {
  const reg = emptyKillSwitch();
  assert.deepEqual(resolveKillSwitch(reg, 'w', 'h'), { global: false, handle: false });
  reg.global = true;
  assert.equal(resolveKillSwitch(reg, 'w', 'h').global, true);
  const reg2 = emptyKillSwitch();
  reg2.workspaces.add('w');
  assert.equal(resolveKillSwitch(reg2, 'w').handle, true);
  const reg3 = emptyKillSwitch();
  reg3.handles.add('h');
  assert.equal(resolveKillSwitch(reg3, 'other', 'h').handle, true);
});

// --- the gate ---
const members: Membership[] = [{ userId: 'u', workspaceId: 'w', role: 'CREATOR' }];
const baseReq = (o: Partial<GateRequest> = {}): GateRequest => ({
  userId: 'u',
  workspaceId: 'w',
  action: Action.LOOP_CREATE,
  memberships: members,
  verification: 'verified',
  ...o,
});

test('gate: happy path allows + returns role and tenant scope', () => {
  const d = gateRequest(baseReq());
  assert.ok(d.allowed);
  assert.equal(d.role, 'CREATOR');
  assert.equal(d.tenantScope, 'w');
});

test('gate: unverified identity is denied at the Medium gate', () => {
  const d = gateRequest(baseReq({ verification: 'pending' }));
  assert.equal(d.allowed, false);
  assert.match(d.reason ?? '', /Medium gate/);
});

test('gate: no membership is denied', () => {
  const d = gateRequest(baseReq({ userId: 'stranger' }));
  assert.equal(d.allowed, false);
  assert.match(d.reason ?? '', /no membership/);
});

test('gate: kill switches deny', () => {
  const global = emptyKillSwitch();
  global.global = true;
  assert.equal(gateRequest(baseReq({ killSwitch: global })).allowed, false);
  const wsKill = emptyKillSwitch();
  wsKill.workspaces.add('w');
  assert.equal(gateRequest(baseReq({ killSwitch: wsKill })).allowed, false);
});

test('gate: insufficient role is denied', () => {
  const viewer: Membership[] = [{ userId: 'u', workspaceId: 'w', role: 'VIEWER' }];
  const d = gateRequest(baseReq({ action: Action.POST_PUBLISH, memberships: viewer }));
  assert.equal(d.allowed, false);
  assert.match(d.reason ?? '', /cannot/);
});

test('gate: handle.connect enforces the 3-handle cap', () => {
  const mgr: Membership[] = [{ userId: 'u', workspaceId: 'w', role: 'MANAGER' }];
  const atCap = gateRequest(baseReq({ action: Action.HANDLE_CONNECT, memberships: mgr, tier: 'TEAM', currentHandleCount: 3 }));
  assert.equal(atCap.allowed, false);
  assert.match(atCap.reason ?? '', /handle cap/);
  const belowCap = gateRequest(baseReq({ action: Action.HANDLE_CONNECT, memberships: mgr, tier: 'TEAM', currentHandleCount: 2 }));
  assert.equal(belowCap.allowed, true);
  const missing = gateRequest(baseReq({ action: Action.HANDLE_CONNECT, memberships: mgr }));
  assert.equal(missing.allowed, false);
  assert.match(missing.reason ?? '', /requires tier/);
});
