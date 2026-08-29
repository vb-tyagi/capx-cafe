-- Plan metering v2 (Short/Tall/Grande — locked 2026-08-29): per-cycle usage counters, cycle-scoped
-- pack balances, the thread index (chain position of every sent post), and per-user plan assignment
-- (P4 billing writes user_plan; unassigned users fall back to CAPX_APP_DEFAULT_PLAN).
-- Cycles are UTC calendar months ('2026-08'); packs expire with the cycle by never being read again.

create table if not exists plan_usage (
  email_hash text not null,
  cycle text not null,
  category text not null,
  used integer not null default 0,
  primary key (email_hash, cycle, category)
);

create table if not exists pack_balance (
  email_hash text not null,
  cycle text not null,
  category text not null,
  remaining integer not null default 0,
  primary key (email_hash, cycle, category)
);

create table if not exists thread_index (
  email_hash text not null,
  platform_post_id text not null,
  root_id text not null,
  depth integer not null,
  primary key (email_hash, platform_post_id)
);

create table if not exists user_plan (
  email_hash text primary key,
  plan text not null
);
