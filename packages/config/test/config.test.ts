import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv, EnvValidationError, appEnvSchema } from '../src/index.ts';

const FULL: Record<string, string> = {
  NODE_ENV: 'production',
  WEB_PORT: '4343',
  DATABASE_URL: 'postgres://capx:capx@localhost:5433/capx',
  REDIS_URL: 'redis://localhost:6380',
  PLATFORM_API_URL: 'http://localhost:3000',
  PLATFORM_HMAC_SECRET: 'secret',
  KMS_KEY_ID: 'kms-1',
};

test('valid env parses with type coercion', () => {
  const env = parseEnv(appEnvSchema, FULL);
  assert.equal(env.WEB_PORT, 4343);
  assert.equal(typeof env.WEB_PORT, 'number');
  assert.equal(env.NODE_ENV, 'production');
});

test('defaults apply when a var is absent', () => {
  const env = parseEnv(appEnvSchema, {
    DATABASE_URL: FULL.DATABASE_URL,
    REDIS_URL: FULL.REDIS_URL,
    PLATFORM_API_URL: FULL.PLATFORM_API_URL,
    PLATFORM_HMAC_SECRET: 'x',
    KMS_KEY_ID: 'x',
  });
  assert.equal(env.NODE_ENV, 'development'); // default
  assert.equal(env.WEB_PORT, 4343); // default '4343' coerced to number
});

test('missing required vars fail fast, aggregating ALL problems', () => {
  let err: unknown;
  try {
    parseEnv(appEnvSchema, { NODE_ENV: 'development' });
  } catch (e) {
    err = e;
  }
  assert.ok(err instanceof EnvValidationError);
  const ev = err as EnvValidationError;
  assert.ok(ev.problems.length >= 4, 'reports all missing required vars at once');
  assert.ok(ev.problems.some((p) => p.includes('DATABASE_URL')));
});

test('bad values are rejected per type (number/url/boolean)', () => {
  assert.throws(() => parseEnv({ P: { type: 'number', required: true } }, { P: 'abc' }), EnvValidationError);
  assert.throws(() => parseEnv({ U: { type: 'url', required: true } }, { U: 'not a url' }), EnvValidationError);
  assert.throws(() => parseEnv({ B: { type: 'boolean', required: true } }, { B: 'maybe' }), EnvValidationError);
});
