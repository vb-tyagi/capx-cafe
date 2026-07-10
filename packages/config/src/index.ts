export * from './env.ts';
import type { EnvSchema } from './env.ts';

/** The application's environment contract. Keep .env.example in sync with this. */
export const appEnvSchema: EnvSchema = {
  NODE_ENV: { type: 'string', default: 'development', description: 'runtime environment' },
  WEB_PORT: { type: 'number', default: '4343', description: 'Next.js BFF dev port (capx 43xx convention)' },
  DATABASE_URL: { type: 'url', required: true, description: 'closed-side Postgres' },
  REDIS_URL: { type: 'url', required: true, description: 'BullMQ queue' },
  PLATFORM_API_URL: { type: 'url', required: true, description: "open Postiz fork API (arm's-length)" },
  PLATFORM_HMAC_SECRET: { type: 'string', required: true, description: 'HMAC for fork<->closed webhooks' },
  KMS_KEY_ID: { type: 'string', required: true, description: 'closed-side secrets key (KMS)' },
  PLATFORM_MODE: { type: 'string', default: 'fake', description: "'fake' (dev) | 'http' (real capx-cafe)" },
  PLATFORM_SERVICE_TOKEN: { type: 'string', required: false, description: 'capx-cafe API key / service token' },
  PLATFORM_POSTS_PATH: { type: 'string', default: '/api/posts', description: 'Postiz public API: /public/v1/posts' },
};
