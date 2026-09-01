-- Stub of what a real Supabase project provides out of the box, just
-- enough to run our migrations and RLS policies against a bare
-- postgres:16 container for local verification. NOT part of the real
-- Supabase migration set (Supabase already provides all of this) and
-- never applied to an actual Supabase project.

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Supabase's auth.uid() reads the JWT "sub" claim set per-request by
-- PostgREST. We simulate that with a settable custom GUC so tests can
-- "become" a given user with `select set_config('request.jwt.claim.sub', '<uuid>', true);`
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')::text;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
-- Supabase grants broad default table privileges on public to anon/authenticated,
-- and service_role gets full access to everything (it's meant to bypass
-- app-level restriction entirely, same as in a real Supabase project).
-- Our RLS policies (0003) are what actually restrict anon/authenticated,
-- plus the explicit REVOKEs in that file for the credit tables.
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to service_role;
