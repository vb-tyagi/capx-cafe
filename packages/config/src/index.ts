export * from './env.ts';
import type { EnvSchema } from './env.ts';

/**
 * The chokepoint (services/chokepoint) SERVER env contract — the ONLY place secrets live.
 * Option B: NO multi-tenant user DB; VAULT_DB_URL is the ONE Postgres holding the token vault +
 * hashed allowlist + kill-list + audit + outbox + recent-post cache. Keep .env.example in sync.
 */
export const serverEnvSchema: EnvSchema = {
  NODE_ENV: { type: 'string', default: 'development', oneOf: ['development', 'production', 'test'], description: 'runtime environment' },
  CAPX_DEPLOY_MODE: { type: 'string', default: 'hosted', oneOf: ['hosted', 'self-host'], description: 'self-host disables lane B (capx-app) as config, never a code fork' },
  CHOKEPOINT_PORT: { type: 'number', default: '4477', description: 'chokepoint HTTP port' },
  VAULT_DB_URL: { type: 'url', required: true, description: 'the ONE Postgres: token vault + hashed allowlist + kill-list + audit + outbox + recent-post cache' },
  KMS_KEY_ID: { type: 'string', required: true, secret: true, description: 'envelope-encryption key for the X-token vault (cloud KMS hosted / local key self-host)' },
  SESSION_SIGNING_KEY: { type: 'string', required: true, secret: true, description: 'signs short-TTL session handles' },
  OAUTH_CALLBACK_URL: { type: 'url', required: true, httpsOnly: true, description: 'hosted HTTPS callback (same redirect_uri for both lanes)' },
  X_CLIENT_ID: { type: 'string', required: false, description: 'capx-app (lane B) OAuth2 client id; absent for BYO-only / self-host' },
  X_CLIENT_SECRET: { type: 'string', required: false, secret: true, description: 'capx-app (lane B) confidential secret; HOSTED-ONLY, never in the open-source image' },
  MOR_WEBHOOK_SECRET: { type: 'string', required: false, secret: true, description: 'MoR -> hashed-allowlist webhook signature (P4; stubbed in P1)' },
  REDIS_URL: { type: 'url', required: false, description: 'optional P3 hosted-scale queue driver; P1 uses a Postgres SKIP LOCKED poller' },
};

/**
 * The agent-co-resident MCP server (apps/capx-mcp) CLIENT env contract. THIN and SECRET-FREE:
 * it holds only a short-TTL session handle + non-secret pointers. Resolve host-agnostically via
 * mergeSources in the order env -> ~/.capx/config.json -> chokepoint session (absent file tolerated).
 */
export const clientEnvSchema: EnvSchema = {
  CAPX_CHOKEPOINT_URL: { type: 'url', required: true, description: 'points the MCP server at any chokepoint (hosted or self-hosted)' },
  CAPX_LANE: { type: 'string', required: false, default: 'byo', oneOf: ['byo', 'capx-app'], description: 'selected lane' },
  X_CLIENT_ID: { type: 'string', required: false, description: "BYO lane: the user's OWN public (non-secret) X client id" },
};
