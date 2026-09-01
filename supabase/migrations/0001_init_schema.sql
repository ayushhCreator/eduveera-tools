-- Eduveera Tools — initial schema
-- Matches DATABASE.md exactly. Table order respects FK dependencies.

create extension if not exists pgcrypto;

-- ============================================================
-- profiles (extends auth.users 1:1)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text not null unique,
  phone text unique,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- credits (one row per user, current balance only)
-- ============================================================
create table credits (
  user_id uuid primary key references profiles (id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- pricing_plans (configurable credit packs for purchase)
-- ============================================================
create table pricing_plans (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  price_inr numeric(10, 2) not null check (price_inr > 0),
  credits integer not null check (credits > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- tool_pricing (configurable per-tool credit cost)
-- ============================================================
create table tool_pricing (
  tool text primary key check (tool in ('image_compressor', 'passport_photo', 'hindi_converter')),
  cost_credits integer not null check (cost_credits >= 0),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- credit_transactions (append-only ledger)
-- ============================================================
create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id),
  type text not null check (type in ('credit', 'debit')),
  amount integer not null check (amount <> 0),
  reason text not null,
  reference text,
  balance_after integer not null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index credit_transactions_user_created_idx on credit_transactions (user_id, created_at desc);
create index credit_transactions_created_idx on credit_transactions (created_at desc);

-- ============================================================
-- payments (manual UTR flow; gateway fields reserved for future)
-- ============================================================
create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id),
  pricing_plan_id uuid not null references pricing_plans (id),
  amount_inr numeric(10, 2) not null,
  credits_requested integer not null,
  utr text unique,
  gateway_payment_id text unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payments_has_reference check (utr is not null or gateway_payment_id is not null)
);

create index payments_status_created_idx on payments (status, created_at);

-- ============================================================
-- tool_usage (one row per tool invocation attempt)
-- ============================================================
create table tool_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id),
  tool text not null check (tool in ('image_compressor', 'passport_photo', 'hindi_converter')),
  status text not null check (status in ('success', 'failed')),
  credits_charged integer not null default 0,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index tool_usage_tool_created_idx on tool_usage (tool, created_at desc);
create index tool_usage_user_created_idx on tool_usage (user_id, created_at desc);

-- ============================================================
-- admin_users (elevated access; provisioned out-of-band, no self-serve)
-- ============================================================
create table admin_users (
  user_id uuid primary key references profiles (id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);
