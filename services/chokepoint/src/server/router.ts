// The chokepoint HTTP surface — a transport-agnostic router (pure: request in, response out, no
// socket) so it unit-tests with no port. node:http adapter in ./http.ts. Routes (§5):
//   GET  /healthz          liveness
//   POST /session          {emailHash} -> {bearer}         (allowlist/license gate; P4 = MoR-gated)
//   POST /oauth/start      Bearer      -> {consentUrl, pendingId, sessionNonce}
//   GET  /oauth/callback   ?state&code -> HTML             (X's redirect; token exchange + identity)
//   POST /oauth/confirm    Bearer {pendingId, sessionNonce} -> {connected, username}  (vault write)
//   POST /whoami           Bearer      -> {connected, username, lane, needsReauth}
//   POST /post_now         Bearer {text, aiGenerated?, idempotencyKey} -> PostResult
//   POST /admin/revoke     x-admin-key {global?, handleKey?} -> {ok}
import { AccountStanding, emailHash } from '@capx/core';
import type { Lane } from '@capx/core';
import type { Admission } from '../admission/index.ts';
import type { Vault } from '../vault/index.ts';
import type { OAuthFlow, TokenExchange, IdentityFetch } from '../oauth/index.ts';
import type { PublishGate } from '../gate/index.ts';
import { generateSessionNonce } from '../oauth/pkce.ts';

export interface ServiceRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
  headers: Record<string, string | undefined>;
}
export interface ServiceResponse {
  status: number;
  body: unknown;
  contentType?: 'application/json' | 'text/html';
}
export interface ChokepointService {
  handle(req: ServiceRequest): Promise<ServiceResponse>;
}

export interface ServiceDeps {
  admission: Admission;
  vault: Vault;
  oauth: OAuthFlow;
  gate: PublishGate;
  adminKey: string;
  now: () => number;
  tokenExchange: TokenExchange; // injected: mock X in dev/tests, real endpoints in prod
  identity: IdentityFetch;
  byoDefaultClientId?: string;
}

const json = (status: number, body: unknown): ServiceResponse => ({ status, body, contentType: 'application/json' });
const html = (status: number, body: string): ServiceResponse => ({ status, body, contentType: 'text/html' });

function bearer(headers: Record<string, string | undefined>): string | null {
  const h = headers['authorization'] ?? headers['Authorization'];
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice('Bearer '.length);
}
function asObj(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

export function createService(deps: ServiceDeps): ChokepointService {
  async function handle(req: ServiceRequest): Promise<ServiceResponse> {
    const now = deps.now();
    const route = `${req.method} ${req.path}`;

    // /health is the canonical liveness probe. NOT /healthz: Google's Frontend RESERVES the literal
    // path /healthz on Cloud Run and answers it with its own 404 — the request never reaches this
    // container, so a healthy service looks dead. /healthz is kept as an alias for local + self-host
    // deployments, where nothing intercepts it. Verified empirically 2026-07-17 (GET /zzz reached the
    // app while GET /healthz did not).
    if (route === 'GET /health' || route === 'GET /healthz') {
      return json(200, { ok: true, service: 'capx-chokepoint' });
    }

    if (route === 'POST /session') {
      const emailHash = String(asObj(req.body).emailHash ?? '');
      if (!emailHash) return json(400, { error: 'emailHash required' });
      if (!(await deps.admission.isAllowlisted(emailHash))) return json(403, { error: 'not allowlisted' });
      return json(200, { bearer: deps.admission.issueSession(emailHash, now) });
    }

    if (route === 'POST /oauth/start') {
      const tok = bearer(req.headers);
      if (!tok) return json(401, { error: 'missing bearer' });
      const adm = await deps.admission.admit(tok, now);
      if (!adm.admitted || !adm.emailHash) return json(401, { error: adm.reason ?? 'not admitted' });
      const b = asObj(req.body);
      const lane = (b.lane === 'CAPX_APP' ? 'CAPX_APP' : 'BYO') as Lane;
      const clientId = String(b.clientId ?? deps.byoDefaultClientId ?? '');
      if (!clientId) return json(400, { error: 'clientId required (BYO: your X app client id)' });
      const sessionNonce = generateSessionNonce();
      const started = await deps.oauth.start({ lane, clientId, emailHash: adm.emailHash, sessionNonce, now });
      return json(200, { consentUrl: started.consentUrl, pendingId: started.pendingId, sessionNonce, expiresAt: started.expiresAt });
    }

    if (req.method === 'GET' && req.path === '/oauth/callback') {
      const { state, code } = req.query;
      if (!state || !code) return html(400, '<h1>Missing state/code</h1>');
      try {
        const { username } = await deps.oauth.handleRedirect({ state, code, now }, deps.tokenExchange, deps.identity);
        return html(200, `<h1>Connected @${username}</h1><p>Return to your terminal and confirm.</p>`);
      } catch (e) {
        return html(400, `<h1>Connection failed</h1><p>${e instanceof Error ? e.message : 'error'}</p>`);
      }
    }

    if (route === 'POST /oauth/confirm') {
      const tok = bearer(req.headers);
      if (!tok) return json(401, { error: 'missing bearer' });
      const adm = await deps.admission.admit(tok, now);
      if (!adm.admitted || !adm.emailHash) return json(401, { error: adm.reason ?? 'not admitted' });
      const b = asObj(req.body);
      const pendingId = String(b.pendingId ?? '');
      const sessionNonce = String(b.sessionNonce ?? '');
      try {
        const conn = await deps.oauth.confirm({ pendingId, sessionNonce });
        if (conn.emailHash !== adm.emailHash) return json(403, { error: 'session/connection mismatch' });
        await deps.vault.put(
          {
            emailHash: conn.emailHash,
            xUserId: conn.xUserId,
            username: conn.username,
            lane: conn.lane,
            standing: AccountStanding.GOOD,
            // Real account facts from X — casserole L1 gates Loops on these.
            verified: conn.verified,
            createdAtMs: conn.createdAtMs,
          },
          { access: conn.accessToken, refresh: conn.refreshToken },
        );
        return json(200, { connected: true, username: conn.username });
      } catch (e) {
        return json(400, { error: e instanceof Error ? e.message : 'confirm failed' });
      }
    }

    if (route === 'POST /whoami') {
      const tok = bearer(req.headers);
      if (!tok) return json(401, { error: 'missing bearer' });
      const adm = await deps.admission.admit(tok, now);
      if (!adm.admitted || !adm.emailHash) return json(401, { error: adm.reason ?? 'not admitted' });
      const ref = await deps.vault.refByEmailHash(adm.emailHash);
      if (!ref) return json(200, { connected: false });
      const meta = await deps.vault.getMetadata(ref);
      const needsReauth = await deps.vault.needsReauth(ref);
      return json(200, { connected: true, username: meta?.username, lane: meta?.lane, needsReauth });
    }

    if (route === 'POST /post_now') {
      const tok = bearer(req.headers);
      if (!tok) return json(401, { error: 'missing bearer' });
      const b = asObj(req.body);
      const text = String(b.text ?? '');
      const idempotencyKey = String(b.idempotencyKey ?? '');
      if (!idempotencyKey) return json(400, { error: 'idempotencyKey required' });
      const result = await deps.gate.postNow({ bearer: tok, text, aiGenerated: Boolean(b.aiGenerated), idempotencyKey });
      return json(200, result);
    }

    if (route === 'POST /admin/allow') {
      const key = req.headers['x-admin-key'];
      if (!key || key !== deps.adminKey) return json(403, { error: 'bad admin key' });
      const b = asObj(req.body);
      // Accept a raw email (hashed here with the shared @capx/core rule) or a pre-computed hash.
      const hash = b.emailHash ? String(b.emailHash) : b.email ? emailHash(String(b.email)) : '';
      if (!hash) return json(400, { error: 'email or emailHash required' });
      await deps.admission.ingestAllowlist(hash, true); // admin key already authenticated this call
      return json(200, { ok: true, emailHash: hash });
    }

    if (route === 'POST /admin/revoke') {
      const key = req.headers['x-admin-key'];
      if (!key || key !== deps.adminKey) return json(403, { error: 'bad admin key' });
      const b = asObj(req.body);
      await deps.admission.revoke({
        global: typeof b.global === 'boolean' ? b.global : undefined,
        handleKey: b.handleKey ? String(b.handleKey) : undefined,
      });
      return json(200, { ok: true });
    }

    return json(404, { error: `no route ${route}` });
  }

  return { handle };
}
