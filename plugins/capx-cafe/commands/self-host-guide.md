---
description: "Stand up your OWN capx chokepoint — the self-hostable image that holds the token vault and runs the guard at send. Walks the real needs from the repo; never fabricates commands."
argument-hint: "[optional: where you want to host — 'Railway', 'a VPS + domain', a tunnel — or the env var you're stuck on]"
---
<!-- GENERATED from skills/self-host-guide/SKILL.md by tools/gen-skills.mjs — do not hand-edit; edit the source. -->

Walk the user through standing up their **own** capx chokepoint — the one self-hostable image that holds the
KMS-encrypted token vault and runs the casserole guard server-side at every send. This is a **guide**: you
read the repo and point at real files. **Do not invent commands or env vars** — everything below traces to a
file in this repo; if something isn't there, say so instead of guessing. User's host/intent, if any: "$ARGUMENTS"

Follow these steps:

1. **Read the real self-host story first.** Open `docs/P1-CHOKEPOINT.md` §8 (self-host, honest) and §1
   (architecture in one picture), plus `services/chokepoint/README.md`. These are ground truth. The honest
   claim is **"one code path, one mode flag — but N required secrets and a public HTTPS domain,"** *not*
   "compose up and you're done." Hosted-capx and any self-hoster run the **identical** image; the only
   difference is configuration. Don't promise the user a one-liner.

2. **Confirm the things they must bring.** Self-host = **BYO-only** (they pay X directly; no capx secret, no
   MoR, no counter). They need: (a) a host that runs the image (`services/chokepoint/Dockerfile`, or
   `node --experimental-strip-types services/chokepoint/src/serve.ts` — `serve.ts` honors `$PORT`, so
   Railway/Render/Fly/Heroku route to it with no port config); (b) **one Postgres** — `VAULT_DB_URL` (no Redis
   in P1); (c) a **KMS key or local key** — `KMS_KEY_ID`; (d) their **own X app**; (e) a **public HTTPS URL**
   for `OAUTH_CALLBACK_URL` (real domain + TLS, or a tunnel). If they cannot provide a public HTTPS callback,
   **stop here and say so** — the hosted-callback OAuth flow physically cannot complete without one.

3. **Register their own X app.** At developer.x.com → Project + App → enable **OAuth 2.0**, permissions
   **Read and write**, scopes `tweet.read tweet.write users.read offline.access`. The callback/redirect URL
   registered there **must equal** the `OAUTH_CALLBACK_URL` they set on the server. For BYO public PKCE they
   need only the public **client id** — no confidential secret. (The `X_CLIENT_ID`/`X_CLIENT_SECRET` *pair* in
   `serve.ts` is the HOSTED lane-B case; self-host stays BYO, so leave the **secret** unset.)

4. **Set the server env.** These are the required server vars from `packages/config/src/index.ts`
   (`serverEnvSchema`) — cite them exactly, don't paraphrase names: `CAPX_DEPLOY_MODE=self-host` (disables lane
   B as config, never a code fork), `VAULT_DB_URL`, `KMS_KEY_ID` (secret), `SESSION_SIGNING_KEY` (secret),
   `ADMIN_API_KEY` (secret — gates `POST /admin/revoke`), and `OAUTH_CALLBACK_URL` (required, **https-only**: a
   non-https URL is rejected at boot). `CHOKEPOINT_PORT` defaults to `4477`. Generate the three key/secret
   values as long random strings and **never commit them**. Leave `X_CLIENT_SECRET` and `MOR_WEBHOOK_SECRET`
   unset for BYO self-host; optionally set `X_CLIENT_ID` to their own **public** id as the BYO default.

5. **Seed the allowlist.** Admission is a hashed-email allowlist — see the `allowlist(email_hash)` table in
   `services/chokepoint/migrations/001_init.sql`. An empty allowlist **denies everyone** by design (fail-closed),
   so nothing connects until their own email hash is seeded in. Migrations run automatically on boot (`serve.ts`
   calls `runMigrations`); follow the repo's admission seeding path — don't hand-write SQL you can't cite.

6. **Boot it.** From `services/chokepoint`, `docker compose up` brings up worker + Postgres (Compose project
   `capx-chokepoint`, host Postgres on **5442** — confirm it's free first). On a PaaS, deploy the `Dockerfile`
   and set the env vars in the dashboard. `serve.ts` opens Postgres, runs migrations, wires the real X
   endpoints, and logs `capx-chokepoint listening on :<port>`. Verify it's up by hitting `GET /healthz`.

7. **Point the agent client at THEIR instance.** The only client-side change (see `clientEnvSchema` in the same
   config file): set **`CAPX_CHOKEPOINT_URL`** to their chokepoint's public base URL — this is what makes the
   capx MCP tools talk to their instance instead of hosted capx. Keep `CAPX_LANE=byo`, and set the client
   `X_CLIENT_ID` to their own public id if they didn't set a server default. **No secret ever goes in the
   client** — it holds only a short-TTL session handle + non-secret pointers.

8. **Connect and verify end-to-end.** Run the `connect` skill against the new instance, then call
   `whoami` — it should report `connected` on their own account through their own chokepoint. Have them do one
   `post_now` and confirm it publishes. **The guard still runs:** casserole ships inside the image and gates
   every send server-side on their instance exactly as on hosted — self-host does not remove the gate. What it
   *does* change (be honest, per `docs/P1-CHOKEPOINT.md` §9): a weak local `KMS_KEY_ID` lowers the bar for
   **their own** tokens only.

**Hard rules:** reference the repo, never fabricate. If a command or env var isn't in the files you read, tell
the user it's unspecified and point at the doc — don't make one up. Ground every requirement in reality:
self-host is honest work (a public HTTPS domain + real secrets + a seeded allowlist), not a one-liner, and the
casserole guard runs at send whether they host it or capx does.
