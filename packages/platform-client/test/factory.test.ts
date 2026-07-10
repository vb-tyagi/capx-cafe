import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createPlatformClient, FakePlatformClient, HttpPlatformClient } from '../src/index.ts';

test('factory returns a working Fake in fake mode', async () => {
  const c = createPlatformClient({ mode: 'fake' });
  assert.ok(c instanceof FakePlatformClient);
  const r = await c.publish({ channelId: 'x', text: 't', scheduledAtMs: 1, aiLabel: false });
  assert.match(r.platformPostId, /^fake-post-/);
});

test('factory returns Http in http mode; throws without baseUrl', () => {
  assert.ok(createPlatformClient({ mode: 'http', baseUrl: 'http://localhost:3000' }) instanceof HttpPlatformClient);
  assert.throws(() => createPlatformClient({ mode: 'http' }), /requires baseUrl/);
});

test('HttpPlatformClient honors postsPath + Postiz-style raw API-key header', async () => {
  const holder: { path: string | null; auth: string | null } = { path: null, auth: null };
  const server = createServer((req, res) => {
    holder.path = req.url ?? null;
    holder.auth = typeof req.headers['authorization'] === 'string' ? req.headers['authorization'] : null;
    req.on('data', () => {});
    req.on('end', () => {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ platformPostId: 'p1' }));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const addr = server.address();
  const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
  try {
    const c = new HttpPlatformClient(`http://127.0.0.1:${port}`, {
      serviceToken: 'KEY123',
      postsPath: '/public/v1/posts',
      authHeaderValue: (t) => t, // Postiz-style: raw key, no "Bearer"
    });
    const r = await c.publish({ channelId: 'ch', text: 'hi', scheduledAtMs: 0, aiLabel: false });
    assert.equal(r.platformPostId, 'p1');
    assert.equal(holder.path, '/public/v1/posts');
    assert.equal(holder.auth, 'KEY123');
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
