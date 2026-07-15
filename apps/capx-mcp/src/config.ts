// Host-agnostic client config: resolve via the layered order env -> ~/.capx/config.json -> chokepoint
// session (mergeSources). SECRET-FREE by construction (clientEnvSchema). The email->hash is the identity
// key shared with the chokepoint allowlist; the MCP never sends the raw email anywhere.
import { createHash } from 'node:crypto';
import { mergeSources, parseEnv, clientEnvSchema } from '@capx/config';

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

/** Deterministic identity key from an email. MUST match the chokepoint's allowlist hashing. */
export function emailHash(email: string): string {
  return `h_${createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 32)}`;
}
