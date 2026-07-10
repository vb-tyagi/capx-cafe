// capx-conductor — kill switches. resolveKillSwitch() produces the exact { global, handle }
// shape that capx-casserole's L1 gauntlet layer consumes, so a pause here stops posting there.
export interface KillSwitchRegistry {
  global: boolean;
  workspaces: Set<string>;
  handles: Set<string>;
}

export function emptyKillSwitch(): KillSwitchRegistry {
  return { global: false, workspaces: new Set(), handles: new Set() };
}

export function resolveKillSwitch(
  reg: KillSwitchRegistry,
  workspaceId?: string,
  handleId?: string,
): { global: boolean; handle: boolean } {
  const handle =
    (workspaceId !== undefined && reg.workspaces.has(workspaceId)) ||
    (handleId !== undefined && reg.handles.has(handleId));
  return { global: reg.global, handle };
}
