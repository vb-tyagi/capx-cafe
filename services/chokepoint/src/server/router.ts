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
import { AccountStanding, emailHash } from '@capx-cafe/core';
import type { Lane } from '@capx-cafe/core';
import type { Admission } from '../admission/index.ts';
import type { Vault } from '../vault/index.ts';
import type { OAuthFlow, TokenExchange, IdentityFetch } from '../oauth/index.ts';
import type { PublishGate } from '../gate/index.ts';
import type { MediaGateway } from '../media/index.ts';
import type { Loops } from '../loops/index.ts';
import type { LoopTicker } from '../loops/tick.ts';
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
  media: MediaGateway;
  loops: Loops;
  ticker: LoopTicker;
  adminKey: string;
  now: () => number;
  tokenExchange: TokenExchange; // injected: mock X in dev/tests, real endpoints in prod
  identity: IdentityFetch;
  byoDefaultClientId?: string;
  /** the hosted HTTPS callback — the wizard shows it verbatim, since it must match X byte-for-byte. */
  callbackUrl: string;
}

const json = (status: number, body: unknown): ServiceResponse => ({ status, body, contentType: 'application/json' });
const html = (status: number, body: string): ServiceResponse => ({ status, body, contentType: 'text/html' });

/** The callback URL is operator-configured, but it lands in an HTML attribute — escape it anyway. */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

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

    // The BYO onboarding wizard (decision §5.6). BYO is a developer wall in front of a creator tool:
    // registering an X app is ~8 screens, and the most common failure is a callback that doesn't match
    // BYTE-FOR-BYTE — which X reports as an opaque error. So the chokepoint serves the exact callback
    // string to copy rather than asking anyone to retype it.
    if (route === 'GET /connect/guide') {
      const cb = escapeHtml(deps.callbackUrl);
      return html(
        200,
        `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>capx — connect your X account</title>
<style>
 :root{color-scheme:light dark}
 body{font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:44rem;margin:3rem auto;padding:0 1.25rem}
 h1{font-size:1.6rem;margin:0 0 .25rem} p.sub{opacity:.7;margin:0 0 2rem}
 ol{padding-left:1.2rem} li{margin:.9rem 0}
 code{background:rgba(127,127,127,.16);padding:.15rem .4rem;border-radius:4px;font-size:.9em}
 .cb{display:flex;gap:.5rem;align-items:center;margin:.6rem 0}
 .cb input{flex:1;font:13px ui-monospace,SFMono-Regular,Menlo,monospace;padding:.6rem;border:1px solid rgba(127,127,127,.4);border-radius:6px;background:transparent;color:inherit}
 button{padding:.6rem .9rem;border:0;border-radius:6px;background:#1d9bf0;color:#fff;font-weight:600;cursor:pointer}
 .warn{border-left:3px solid #e0245e;padding:.5rem 0 .5rem .9rem;margin:1.5rem 0}
 .ok{border-left:3px solid #17bf63;padding:.5rem 0 .5rem .9rem;margin:1.5rem 0}
 a{color:#1d9bf0}
</style>
<h1>Connect your X account</h1>
<p class=sub>You bring your own X app, so <strong>you</strong> hold the API quota and capx never pays for your posts. About 5 minutes, once.</p>
<ol>
 <li>Open <a href="https://developer.x.com/en/portal/dashboard" target="_blank" rel="noopener">the X developer portal</a> and sign in as the account you want to post from.</li>
 <li>First time? Apply for a developer account and accept the terms.</li>
 <li><strong>Projects &amp; Apps</strong> → create a <strong>Project</strong> → create an <strong>App</strong> inside it. Any name.</li>
 <li>Open the app → <strong>User authentication settings</strong> → <strong>Set up</strong>.</li>
 <li><strong>App permissions</strong>: <code>Read and write</code>. (Read-only cannot post — the most common mistake after the callback.)</li>
 <li><strong>Type of App</strong>: <code>Native App</code>. It's a public client, so there is no secret to leak.</li>
 <li><strong>Callback URI / Redirect URL</strong> — paste this exactly:
   <div class=cb>
     <input id=cb value="${cb}" readonly onclick="this.select()">
     <button onclick="navigator.clipboard.writeText(document.getElementById('cb').value);this.textContent='Copied'">Copy</button>
   </div>
 </li>
 <li><strong>Website URL</strong>: any URL you own. Save.</li>
 <li>Copy the <strong>OAuth 2.0 Client ID</strong> — that is what capx needs.</li>
</ol>
<div class=warn><strong>The callback must match character-for-character.</strong> A trailing slash, <code>http</code> for <code>https</code>, or a typo all produce the same unhelpful error from X. Use Copy rather than retyping.</div>
<div class=ok><strong>Do not paste your API Key or API Secret.</strong> capx wants the <em>OAuth 2.0 Client ID</em> — a different value on the same page. The Client ID is not a secret, and capx never asks for your secret on this lane.</div>
<p>Then set <code>X_CLIENT_ID</code> in your agent's capx config and run <code>connect_x</code>.</p>`,
      );
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
            // The app this connection was made with — so a later token refresh uses the right client id.
            clientId: conn.clientId,
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
      const inReplyToId = b.inReplyToId ? String(b.inReplyToId) : undefined;
      const mediaIds = Array.isArray(b.mediaIds) ? (b.mediaIds as unknown[]).map(String) : undefined;
      const result = await deps.gate.postNow({ bearer: tok, text, aiGenerated: Boolean(b.aiGenerated), idempotencyKey, inReplyToId, mediaIds });
      return json(200, result);
    }

    // Upload media (Phase 4). The MCP streamed the user's asset bytes here (base64). casserole does NOT
    // inspect media — this admits + uploads to X and returns a media id to attach via post_now { mediaIds }.
    if (route === 'POST /media') {
      const tok = bearer(req.headers);
      if (!tok) return json(401, { error: 'missing bearer' });
      const b = asObj(req.body);
      const bytesBase64 = String(b.bytesBase64 ?? '');
      if (!bytesBase64) return json(400, { error: 'bytesBase64 required' });
      const bytes = Buffer.from(bytesBase64, 'base64');
      const mediaType = String(b.mediaType ?? 'application/octet-stream');
      const category = String(b.category ?? 'tweet_image');
      const result = await deps.media.uploadMedia({ bearer: tok, bytes, mediaType, category });
      return result.rejected ? json(400, result) : json(200, result);
    }

    // Dry-run: casserole verdict for a draft WITHOUT sending (powers draft-review). Read-only.
    if (route === 'POST /preview') {
      const tok = bearer(req.headers);
      if (!tok) return json(401, { error: 'missing bearer' });
      const b = asObj(req.body);
      const result = await deps.gate.preview({ bearer: tok, text: String(b.text ?? ''), aiGenerated: Boolean(b.aiGenerated) });
      return json(200, result);
    }

    // Read-only audit: the caller's own durable send history (powers audit-trail). Own-handle only.
    if (route === 'POST /audit') {
      const tok = bearer(req.headers);
      if (!tok) return json(401, { error: 'missing bearer' });
      const b = asObj(req.body);
      const result = await deps.gate.audit({ bearer: tok, limit: b.limit === undefined ? undefined : Number(b.limit) });
      return json(200, result);
    }

    // ---- Loops (scheduled posting). `posts` is ALWAYS agent-authored: capx runs no model. ----
    if (route.startsWith('POST /loops/')) {
      const tok = bearer(req.headers);
      if (!tok) return json(401, { error: 'missing bearer' });
      const adm = await deps.admission.admit(tok, now);
      if (!adm.admitted || !adm.emailHash) return json(401, { error: adm.reason ?? 'not admitted' });
      const me = adm.emailHash;
      const b = asObj(req.body);

      if (route === 'POST /loops/create') {
        const { loop, problems } = await deps.loops.create({
          emailHash: me,
          timezone: String(b.timezone ?? ''),
          timeOfDayMinutes: Number(b.timeOfDayMinutes),
          daysOfWeek: Array.isArray(b.daysOfWeek) ? (b.daysOfWeek as unknown[]).map(Number) : [],
          posts: Array.isArray(b.posts) ? (b.posts as unknown[]).map(String) : [],
          autonomy: b.autonomy === 'USER_REVIEWED' ? 'USER_REVIEWED' : 'AUTONOMOUS',
          trainingWheelsRemaining: b.trainingWheelsRemaining === undefined ? 0 : Number(b.trainingWheelsRemaining),
          aiGenerated: Boolean(b.aiGenerated),
        });
        return problems.length ? json(400, { problems }) : json(200, { loop });
      }
      if (route === 'POST /loops/list') return json(200, { loops: await deps.loops.list(me) });
      if (route === 'POST /loops/pause') {
        const l = await deps.loops.setPaused(String(b.id ?? ''), me, b.paused !== false);
        return l ? json(200, { loop: l }) : json(404, { error: 'no such loop' });
      }
      if (route === 'POST /loops/topup') {
        const posts = Array.isArray(b.posts) ? (b.posts as unknown[]).map(String) : [];
        if (!posts.length) return json(400, { error: 'posts required (capx does not generate content)' });
        const l = await deps.loops.topUp(String(b.id ?? ''), me, posts);
        return l ? json(200, { loop: l }) : json(404, { error: 'no such loop' });
      }
      if (route === 'POST /loops/delete') {
        return (await deps.loops.remove(String(b.id ?? ''), me)) ? json(200, { ok: true }) : json(404, { error: 'no such loop' });
      }
      return json(404, { error: `no route ${route}` });
    }

    // The scheduler heartbeat. Cloud Run scales to zero, so Cloud Scheduler drives this. Admin-key
    // gated: anyone who could call it could otherwise force loops to fire early.
    if (route === 'POST /internal/tick') {
      const key = req.headers['x-admin-key'];
      if (!key || key !== deps.adminKey) return json(403, { error: 'bad admin key' });
      const results = await deps.ticker.tick();
      return json(200, { checked: results.length, fired: results.filter((r) => r.fired).length, results });
    }

    if (route === 'POST /admin/allow') {
      const key = req.headers['x-admin-key'];
      if (!key || key !== deps.adminKey) return json(403, { error: 'bad admin key' });
      const b = asObj(req.body);
      // Accept a raw email (hashed here with the shared @capx-cafe/core rule) or a pre-computed hash.
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
