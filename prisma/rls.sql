-- Row-Level Security for the closed multi-tenant DB. Apply AFTER `prisma migrate deploy`.
-- Fail-closed: RLS is ENABLED + FORCED (owners included); with no matching policy the default is DENY.
-- The app scopes every request to a tenant per transaction:
--   SELECT set_config('app.workspace_id', $workspaceId, true);
-- LoopRun has no workspaceId column; it is guarded via its parent Loop at the service layer.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Handle','Loop','Post','BrandKit','CreditAccount','CreditTransaction','GuardrailEvent','Invite','Membership'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I '
      'USING ("workspaceId" = current_setting(''app.workspace_id'', true)) '
      'WITH CHECK ("workspaceId" = current_setting(''app.workspace_id'', true));',
      t
    );
  END LOOP;

  -- Workspace is keyed on its own id.
  EXECUTE 'ALTER TABLE "Workspace" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "Workspace" FORCE ROW LEVEL SECURITY';
  EXECUTE
    'CREATE POLICY tenant_isolation ON "Workspace" '
    'USING (id = current_setting(''app.workspace_id'', true)) '
    'WITH CHECK (id = current_setting(''app.workspace_id'', true));';
END $$;
