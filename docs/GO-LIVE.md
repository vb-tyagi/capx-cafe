# capx-culture — Go-Live Guide (the steps that need YOU)

Everything buildable without external accounts is done and tested. The remaining work needs a
running machine + real developer accounts. Do these in order. Commands are copy-paste; replace
`<...>` placeholders.

Two folders are involved:
- **capx-cafe** (the open Postiz fork) → `/Users/tyagicapx/v-my-apps/capx-cafe`
- **capx-culture** (the closed brain) → `/Users/tyagicapx/v-my-apps/capx-culture`

---

## Part 0 — Prerequisites (once)
- **Docker Desktop** installed and running.
- **Node ≥ 22.6** and **pnpm** (`npm i -g pnpm`).

---

## Part 1 — Start capx-cafe (the posting app) locally

```bash
cd /Users/tyagicapx/v-my-apps/capx-cafe

# 1. install (first time is a few minutes — it's a big app)
pnpm install

# 2. start its databases (Postgres + Redis + admin UIs)
pnpm run dev:docker          # = docker compose -f docker-compose.dev.yaml up -d

# 3. create its env file
cp .env.example .env
```

Now open `/Users/tyagicapx/v-my-apps/capx-cafe/.env` and set at least these:
```env
DATABASE_URL="postgresql://postiz-user:postiz-password@localhost:5432/postiz-db-local"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="<any long random string>"
FRONTEND_URL="http://localhost:4200"
NEXT_PUBLIC_BACKEND_URL="http://localhost:3000"
BACKEND_INTERNAL_URL="http://localhost:3000"
STORAGE_PROVIDER="local"
```

Then run the app:
```bash
pnpm run dev
```
- UI: **http://localhost:4200**
- API: **http://localhost:3000**  (note: Postiz defaults to port 3000)

Create your account in the UI (first user) and log in.

---

## Part 2 — Create an X developer app (for real posting)

1. Go to **https://developer.x.com** → create a Project + App.
2. Enable **OAuth 2.0**, set app permissions to **Read and write**.
3. For the **callback/redirect URL**, use the one capx-cafe shows you when you click "connect X"
   in Part 3 (Postiz displays the exact URL). Typically it's under your `FRONTEND_URL`.
4. Copy the **API Key** and **API Secret**.
5. Put them in `/Users/tyagicapx/v-my-apps/capx-cafe/.env`:
```env
X_API_KEY="<your X api key>"
X_API_SECRET="<your X api secret>"
X_URL="http://localhost:4200"
```
6. Restart `pnpm run dev`.

*(LinkedIn later: same idea with `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`.)*

**Reminder:** connect a **real, verified** handle you own. No mass/fake accounts — that's the whole
point of capx-conductor's whitelist + capx-casserole's guard.

---

## Part 3 — Connect your handle + get a capx-cafe API key

1. In the capx-cafe UI (http://localhost:4200): **Add channel → X →** authorize. This does the OAuth
   dance and stores the token **inside capx-cafe** (never in the closed brain — that's the boundary).
2. Generate a **Public API key**: capx-cafe **Settings → Public API →** create key. Copy it.

---

## Part 4 — Point the closed brain at capx-cafe (go live)

```bash
cd /Users/tyagicapx/v-my-apps/capx-culture
cp .env.example .env.local   # if you don't have one yet
```
Edit `.env.local`:
```env
PLATFORM_MODE=http
PLATFORM_API_URL=http://localhost:3000
PLATFORM_SERVICE_TOKEN=<the capx-cafe Public API key from Part 3>
PLATFORM_POSTS_PATH=/public/v1/posts
```
That's the flip: `createPlatformClient()` now returns the real `HttpPlatformClient` instead of the Fake,
and canteen publishes through capx-cafe. No code change.

---

## Part 5 — The ONE remaining code glue (I'll finish this with you)

Postiz's `POST /public/v1/posts` expects **Postiz's own payload shape** (channel/integration id +
content blocks), which is richer than our simple `{ channelId, text }`. So the final step is mapping
`PublishRequest → Postiz's DTO` inside `HttpPlatformClient`.

The easiest way to get it exactly right: in the capx-cafe UI there's a **public-API wizard** — schedule
a post with the UI, then **copy the generated payload**. Paste that sample payload to me and I'll write
the exact mapping in `packages/platform-client/src/http.ts`. After that, going live is purely the env
flip in Part 4.

*(Alternative: add a thin `POST /api/posts` adapter route in the fork that accepts our simple contract
and calls Postiz's `PostsService.createPost`. Keeps the closed side unchanged; keep `PLATFORM_POSTS_PATH=/api/posts`.)*

---

## Sanity checks
```bash
# closed brain still green:
cd /Users/tyagicapx/v-my-apps/capx-culture && pnpm run verify

# boundary enforced from both sides:
node tools/boundary-guard.mjs .
node /Users/tyagicapx/v-my-apps/capx-cafe/tools/capx-boundary-guard.mjs /Users/tyagicapx/v-my-apps/capx-cafe
```
