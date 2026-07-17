// Thin node:http adapter: parse an IncomingMessage into a ServiceRequest, run the pure router, write
// the ServiceResponse. No framework dep. Not unit-tested (the router is); exercised via serve().
import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import type { ChokepointService, ServiceRequest } from './router.ts';

export function createHttpServer(service: ChokepointService): Server {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      void (async () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let body: unknown;
        if (raw) {
          try {
            body = JSON.parse(raw);
          } catch {
            body = raw;
          }
        }
        const url = new URL(req.url ?? '/', 'http://localhost');
        const query: Record<string, string> = {};
        url.searchParams.forEach((v, k) => {
          query[k] = v;
        });
        const headers: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(req.headers)) headers[k] = Array.isArray(v) ? v[0] : v;
        const sreq: ServiceRequest = { method: req.method ?? 'GET', path: url.pathname, query, body, headers };
        const out = await service.handle(sreq);
        const ct = out.contentType ?? 'application/json';
        res.writeHead(out.status, { 'content-type': ct });
        res.end(ct === 'application/json' ? JSON.stringify(out.body) : String(out.body));
      })();
    });
  });
}
