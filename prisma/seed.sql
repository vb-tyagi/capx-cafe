-- Minimal dev seed. Run against the local docker Postgres AFTER migrate + rls.sql.
INSERT INTO "Workspace" (id, name, tier, "createdAt") VALUES ('ws_demo', 'Demo Studio', 'TEAM', now());
INSERT INTO "User" (id, email, "createdAt") VALUES ('usr_demo', 'founder@capx.ai', now());
INSERT INTO "Membership" (id, "workspaceId", "userId", role) VALUES ('mem_demo', 'ws_demo', 'usr_demo', 'OWNER');
INSERT INTO "CreditAccount" (id, "workspaceId", balance) VALUES ('ca_demo', 'ws_demo', 6000);
