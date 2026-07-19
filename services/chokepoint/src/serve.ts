#!/usr/bin/env -S node --experimental-strip-types
// The chokepoint server binary — the deployable entry. Reads serverEnvSchema, opens the ONE Postgres
// (runs migrations), wires the REAL X endpoints into the injected seams, and serves the HTTP surface.
// All logic is createChokepoint/createHttpServer (tested); this is thin, un-unit-tested I/O wiring.
import { parseEnv, serverEnvSchema } from '@capx-cafe/config';
import { createChokepoint, PostgresStore, runMigrations, createHttpServer } from './index.ts';
import type { TokenExchange } from './index.ts';
import { createPgPool } from './store/pg-pool.ts';
import { httpTokenExchange, httpRefreshExchange, httpIdentity } from './xclient/x-api.ts';
import { httpXPoster, httpXMediaUploader, type FetchLike } from './xclient/index.ts';

const realFetch: FetchLike = async (url, init) => {
  const r = await fetch(url, { method: init.method, headers: init.headers, body: init.body });
  return { ok: r.ok, status: r.status, json: () => r.json(), text: () => r.text() };
};

async function main(): Promise<void> {
  const env = parseEnv(serverEnvSchema);
  const s = (k: string): string => String(env[k]);
  const callbackUrl = s('OAUTH_CALLBACK_URL');
  const capxClientId = env.X_CLIENT_ID !== undefined ? String(env.X_CLIENT_ID) : undefined;
  const capxClientSecret = env.X_CLIENT_SECRET !== undefined ? String(env.X_CLIENT_SECRET) : undefined;

  const pool = createPgPool(s('VAULT_DB_URL'));
  await runMigrations(pool);
  const store = new PostgresStore(pool);

  // capx-app (confidential) exchange injects the SERVER-held secret when the client is capx's own app;
  // BYO (public) clients carry no secret. Lane B (capx-app) only exists when both id + secret are set.
  const baseExchange = httpTokenExchange(realFetch, { redirectUri: callbackUrl });
  const tokenExchange: TokenExchange =
    capxClientId && capxClientSecret
      ? (p) => baseExchange(p.clientId === capxClientId ? { ...p, clientSecret: capxClientSecret } : p)
      : baseExchange;

  const cp = createChokepoint(store, {
    masterKeyBase64: s('KMS_KEY_ID'),
    signingKey: s('SESSION_SIGNING_KEY'),
    adminKey: s('ADMIN_API_KEY'),
    oauth: {
      authorizeEndpoint: 'https://twitter.com/i/oauth2/authorize',
      redirectUri: callbackUrl,
      scope: 'tweet.read tweet.write users.read offline.access',
    },
    tokenExchange,
    // The refresh grant reuses the same public/confidential rules as the exchange: BYO sends client_id
    // in the body; the CAPX_APP lane adds the server secret (the Refresher gates that by lane).
    refreshExchange: httpRefreshExchange(realFetch),
    identity: httpIdentity(realFetch),
    xPost: httpXPoster(realFetch),
    xMediaUpload: httpXMediaUploader(realFetch),
    byoDefaultClientId: capxClientId,
    capxAppClientSecret: capxClientSecret,
    now: () => Date.now(),
  });

  // Most PaaS hosts (Railway/Render/Fly/Heroku) inject the port to bind as $PORT and route to it;
  // honour that first so a deploy needs no port config, and fall back to CHOKEPOINT_PORT locally.
  const port = Number(process.env.PORT ?? env.CHOKEPOINT_PORT);
  createHttpServer(cp.service).listen(port, () => {
    const src = process.env.PORT ? 'PORT' : 'CHOKEPOINT_PORT';
    process.stdout.write(`capx-chokepoint listening on :${port} (via ${src}, deploy=${s('CAPX_DEPLOY_MODE')})\n`);
  });
}

main().catch((e: unknown) => {
  process.stderr.write(`capx-chokepoint fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
