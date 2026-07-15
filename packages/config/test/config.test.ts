import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseEnv,
  mergeSources,
  EnvValidationError,
  serverEnvSchema,
  clientEnvSchema,
} from '../src/index.ts';

const SERVER_FULL: Record<string, string> = {
  NODE_ENV: 'production',
  CAPX_DEPLOY_MODE: 'hosted',
  CHOKEPOINT_PORT: '4477',
  VAULT_DB_URL: 'postgres://chokepoint:pw@localhost:5442/chokepoint',
  KMS_KEY_ID: 'kms-1',
  SESSION_SIGNING_KEY: 'sign-key',
  ADMIN_API_KEY: 'admin-key',
  OAUTH_CALLBACK_URL: 'https://capx.example/oauth/callback',
};

test('serverEnvSchema: valid env parses with type coercion', () => {
  const env = parseEnv(serverEnvSchema, SERVER_FULL);
  assert.equal(env.CHOKEPOINT_PORT, 4477);
  assert.equal(typeof env.CHOKEPOINT_PORT, 'number');
  assert.equal(env.CAPX_DEPLOY_MODE, 'hosted');
});

test('serverEnvSchema: defaults apply when a var is absent', () => {
  const { NODE_ENV: _n, CAPX_DEPLOY_MODE: _m, CHOKEPOINT_PORT: _p, ...required } = SERVER_FULL;
  const env = parseEnv(serverEnvSchema, required);
  assert.equal(env.NODE_ENV, 'development'); // default
  assert.equal(env.CAPX_DEPLOY_MODE, 'hosted'); // default
  assert.equal(env.CHOKEPOINT_PORT, 4477); // default '4477' coerced to number
});

test('serverEnvSchema: missing required vars fail fast, aggregating ALL problems', () => {
  let err: unknown;
  try {
    parseEnv(serverEnvSchema, { NODE_ENV: 'production' });
  } catch (e) {
    err = e;
  }
  assert.ok(err instanceof EnvValidationError);
  const ev = err as EnvValidationError;
  assert.ok(ev.problems.length >= 4, 'reports all missing required vars at once');
  assert.ok(ev.problems.some((p) => p.includes('VAULT_DB_URL')));
  assert.ok(ev.problems.some((p) => p.includes('KMS_KEY_ID')));
});

test('clientEnvSchema is THIN: needs only CHOKEPOINT_URL, never vault/KMS', () => {
  const env = parseEnv(clientEnvSchema, { CAPX_CHOKEPOINT_URL: 'https://capx.example' });
  assert.equal(env.CAPX_LANE, 'byo'); // default; no throw despite VAULT_DB_URL/KMS absent
});

test('secret values are REDACTED from error messages', () => {
  let err: unknown;
  try {
    parseEnv({ K: { type: 'number', required: true, secret: true } }, { K: 'super-secret-not-a-number' });
  } catch (e) {
    err = e;
  }
  assert.ok(err instanceof EnvValidationError);
  const msg = (err as EnvValidationError).problems.join('\n');
  assert.ok(msg.includes('<redacted>'));
  assert.ok(!msg.includes('super-secret'), 'raw secret never leaks into the error');
});

test('httpsOnly url rejects non-https and accepts https', () => {
  assert.throws(
    () => parseEnv({ U: { type: 'url', required: true, httpsOnly: true } }, { U: 'http://x.example' }),
    EnvValidationError,
  );
  const ok = parseEnv({ U: { type: 'url', required: true, httpsOnly: true } }, { U: 'https://x.example' });
  assert.equal(ok.U, 'https://x.example');
});

test('oneOf constrains a value to the allowed set', () => {
  assert.throws(
    () => parseEnv({ M: { type: 'string', oneOf: ['hosted', 'self-host'] } }, { M: 'nope' }),
    EnvValidationError,
  );
  const ok = parseEnv({ M: { type: 'string', oneOf: ['hosted', 'self-host'] } }, { M: 'self-host' });
  assert.equal(ok.M, 'self-host');
});

test('bad values are rejected per type (number/url/boolean)', () => {
  assert.throws(() => parseEnv({ P: { type: 'number', required: true } }, { P: 'abc' }), EnvValidationError);
  assert.throws(() => parseEnv({ U: { type: 'url', required: true } }, { U: 'not a url' }), EnvValidationError);
  assert.throws(() => parseEnv({ B: { type: 'boolean', required: true } }, { B: 'maybe' }), EnvValidationError);
});

test('mergeSources: env wins over file over session; absent file tolerated', () => {
  const env = { CAPX_CHOKEPOINT_URL: 'https://env.example' };
  const file = undefined; // ~/.capx/config.json absent on first run
  const session = { CAPX_CHOKEPOINT_URL: 'https://session.example', CAPX_LANE: 'capx-app' };
  const merged = mergeSources(env, file, session);
  assert.equal(merged.CAPX_CHOKEPOINT_URL, 'https://env.example'); // env highest precedence
  assert.equal(merged.CAPX_LANE, 'capx-app'); // filled from the session layer
  const cfg = parseEnv(clientEnvSchema, merged);
  assert.equal(cfg.CAPX_CHOKEPOINT_URL, 'https://env.example');
});
