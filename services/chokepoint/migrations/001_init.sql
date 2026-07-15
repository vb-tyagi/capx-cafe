-- capx-chokepoint schema (Option B: ONE Postgres, no multi-tenant user DB).
-- Every table is keyed by an opaque id or an email HASH — no raw PII. Tokens live only as ciphertext
-- (jsonb SealedToken). Idempotent DDL so runMigrations is safe to re-run.

-- Token vault — ciphertext only (access/refresh are SealedToken jsonb; no plaintext ever).
create table if not exists vault (
  vault_ref          text primary key,
  email_hash         text not null,
  x_user_id          text not null,
  username           text not null,
  lane               text not null,
  standing           text not null,
  access             jsonb not null,
  refresh            jsonb not null,
  refresh_rotated_at bigint not null,
  needs_reauth       boolean not null default false
);
create index if not exists vault_email_hash_idx on vault (email_hash);

-- License allowlist — hashed emails only.
create table if not exists allowlist (
  email_hash text primary key
);

-- Kill-switch: one global flag + a set of killed handle keys. Checked before every send.
create table if not exists kill_global (
  singleton boolean primary key default true,
  killed    boolean not null default false
);
insert into kill_global (singleton, killed) values (true, false) on conflict (singleton) do nothing;

create table if not exists kill_handles (
  handle_key text primary key
);

-- Durable outbox — at-most-once send, idempotent on idempotency_key.
create table if not exists outbox (
  id              text primary key,
  idempotency_key text unique not null,
  email_hash      text not null,
  vault_ref       text not null,
  body            text not null,
  ai_generated    boolean not null,
  lane            text not null,
  state           text not null,
  scheduled_at_ms bigint not null,
  created_at_ms   bigint not null
);

-- Hosted-callback OAuth pending connections (short-lived; resolved is the post-consent tokens jsonb).
create table if not exists oauth_pending (
  pending_id    text primary key,
  verifier      text not null,
  email_hash    text not null,
  lane          text not null,
  client_id     text not null,
  session_nonce text not null,
  created_at    bigint not null,
  expires_at    bigint not null,
  resolved      jsonb
);

-- Lane-B (capx-app) metering — per-handle daily post count.
create table if not exists metering (
  email_hash text not null,
  day_index  bigint not null,
  count      integer not null default 0,
  primary key (email_hash, day_index)
);

-- Per-handle recent-post cache feeding casserole L2/L3 (dedup + ceiling).
create table if not exists recent_posts (
  id         bigserial primary key,
  email_hash text not null,
  body       text not null,
  posted_at  bigint not null,
  loop_id    text
);
create index if not exists recent_posts_idx on recent_posts (email_hash, posted_at);
