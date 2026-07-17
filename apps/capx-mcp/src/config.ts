// Host-agnostic client config: resolve via the layered order env -> ~/.capx/config.json -> chokepoint
// session (mergeSources). SECRET-FREE by construction (clientEnvSchema). The email->hash is the identity
// key shared with the chokepoint allowlist; the MCP never sends the raw email anywhere.
import { mergeSources, parseEnv, clientEnvSchema } from '@capx/config';

// The identity-key rule lives in @capx/core so the client and the chokepoint allowlist can never drift.
export { emailHash } from '@capx/core';

export interface ClientConfig {
  chokepointUrl: string;
  lane: 'byo' | 'capx-app';
  clientId?: string;
}

export function resolveClientConfig(
  ...sources: Array<Record<string, string | undefined> | undefined>
): ClientConfig {
  const env = parseEnv(clientEnvSchema, mergeSources(...sources));
  return {
    chokepointUrl: String(env.CAPX_CHOKEPOINT_URL),
    lane: env.CAPX_LANE === 'capx-app' ? 'capx-app' : 'byo',
    clientId: env.X_CLIENT_ID !== undefined ? String(env.X_CLIENT_ID) : undefined,
  };
}

