// Self-host proof (decision §5.1: the chokepoint is self-hostable — "hosted" is a deployment choice,
// not lock-in). A self-hoster provides ONE local key (KMS_KEY_ID) and runs BYO-only; no cloud KMS, no
// capx X app, no MoR. The SAME composition root + service run identically to the hosted deployment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv, serverEnvSchema, EnvValidationError } from '@capx/config';
import { createInMemoryChokepoint, LocalKeyKms } from '../src/index.ts';

const NOW = 1_700_000_000_000;
const CLEAN =
  'Shipping the anti-slop engine today: deterministic scoring, real unit tests, and zero external keys. Here is a concrete walkthrough of the pipeline.';
const obj = (b: unknown) => b as Record<string, unknown>;

test('self-host env validates with a local key and NO hosted-only secrets', () => {
  const env = parseEnv(serverEnvSchema, {
    CAPX_DEPLOY_MODE: 'self-host',
    VAULT_DB_URL: 'postgres://localhost:5442/chokepoint',
    KMS_KEY_ID: LocalKeyKms.generateMasterKey(),
    SESSION_SIGNING_KEY: 'local-signing-key',
    OAUTH_CALLBACK_URL: 'https://selfhost.example/oauth/callback',
    // no X_CLIENT_ID / X_CLIENT_SECRET / MOR_WEBHOOK_SECRET — BYO-only self-host
  });
  assert.equal(env.CAPX_DEPLOY_MODE, 'self-host');
});

test('CAPX_DEPLOY_MODE rejects an unknown value (oneOf)', () => {
  assert.throws(
    () =>
      parseEnv(serverEnvSchema, {
        CAPX_DEPLOY_MODE: 'nope',
        VAULT_DB_URL: 'https://x.example',
        KMS_KEY_ID: 'k',
        SESSION_SIGNING_KEY: 's',
        OAUTH_CALLBACK_URL: 'https://x.example',
      }),
    EnvValidationError,
  );
});

test('a self-hosted BYO instance connects + posts identically (single local key)', async () => {
  const built = createInMemoryChokepoint({
    masterKeyBase64: LocalKeyKms.generateMasterKey(), // the ONLY key a self-hoster supplies
    signingKey: 'local-signing-key',
    adminKey: 'local-admin',
    oauth: { authorizeEndpoint: 'https://x.example/authorize', redirectUri: 'https://selfhost.example/oauth/callback', scope: 'tweet.write' },
    tokenExchange: async ({ code }) => ({ accessToken: `atok-${code}`, refreshToken: `rtok-${code}` }),
    identity: async () => ({ xUserId: 'x1', username: 'acme' }),
    xPost: async () => ({ id: 'tw-1' }),
    byoDefaultClientId: 'my-own-x-app', // the self-hoster's own X app
    // no capxAppDailyCap -> capx-app lane simply not used
    now: () => NOW,
  });
  const h = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, query: Record<string, string> = {}) =>
    built.service.handle({ method, path, body, headers, query });

  await built.store.addAllowlisted('h_self');
  const bearer = String(obj((await h('POST', '/session', { emailHash: 'h_self' })).body).bearer);
  const start = obj((await h('POST', '/oauth/start', { lane: 'BYO' }, { authorization: `Bearer ${bearer}` })).body);
  await h('GET', '/oauth/callback', undefined, {}, { state: String(start.pendingId), code: 'abc' });
  await h('POST', '/oauth/confirm', { pendingId: start.pendingId, sessionNonce: start.sessionNonce }, { authorization: `Bearer ${bearer}` });
  const post = obj((await h('POST', '/post_now', { text: CLEAN, idempotencyKey: 'k' }, { authorization: `Bearer ${bearer}` })).body);
  assert.equal(post.outcome, 'published');
});
