import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { HttpPlatformClient, PlatformError } from '../src/index.ts';
import type { PlatformClient } from '../src/index.ts';

interface Handled {
  status: number;
  json?: unknown;
}
function startServer(
  handler: (method: string, url: string, body: string) => Handled,
): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const out = handler(req.method ?? 'GET', req.url ?? '/', Buffer.concat(chunks).toString());
        res.statusCode = out.status;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(out.json ?? {}));
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

test('HttpPlatformClient publishes against a running fork API', async () => {
  // holder (not a plain `let`) so TS doesn't narrow the closure-assigned value away.
  const holder: { req: { method: string; url: string; body: { text?: string } } | null } = { req: null };
  const srv = await startServer((method, url, body) => {
    holder.req = { method, url, body: JSON.parse(body) };
    return { status: 200, json: { platformPostId: 'cafe-abc', scheduledAt: 1234 } };
  });
  try {
    const client = new HttpPlatformClient(srv.url);
    const r = await client.publish({ channelId: 'ch1', text: 'hello from canteen', scheduledAtMs: 1234, aiLabel: true });
    assert.equal(r.platformPostId, 'cafe-abc');
    assert.equal(r.scheduledAtMs, 1234);
    const got = holder.req;
    assert.ok(got);
    assert.equal(got.method, 'POST');
    assert.equal(got.url, '/api/posts');
    assert.equal(got.body.text, 'hello from canteen');
  } finally {
    await srv.close();
  }
});

test('HttpPlatformClient surfaces fork errors as PlatformError', async () => {
  const srv = await startServer(() => ({ status: 500, json: { error: 'boom' } }));
  try {
    const client = new HttpPlatformClient(srv.url);
    await assert.rejects(
      client.publish({ channelId: 'ch1', text: 'x', scheduledAtMs: 0, aiLabel: false }),
      (e) => e instanceof PlatformError && e.status === 500,
    );
  } finally {
    await srv.close();
  }
});

test('HttpPlatformClient is a drop-in PlatformClient', () => {
  const client: PlatformClient = new HttpPlatformClient('http://localhost:3000');
  assert.equal(typeof client.publish, 'function');
});
