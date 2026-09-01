-- Row Level Security. Default-deny: RLS enabled on every table, every
-- capability requires an explicit policy. No role other than service_role
-- (which bypasses RLS per Supabase's default role config) can write to
-- credits or credit_transactions — see SECURITY.md § 3.

-- security definer so this can be safely referenced from other tables'
-- policies without triggering RLS recursion against admin_users itself.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

-- ============================================================
-- profiles
-- ============================================================
alter table profiles enable row level security;

create policy profiles_select_own on profiles
  for select using (auth.uid() = id);

create policy profiles_select_admin on profiles
  for select using (public.is_admin());

create policy profiles_update_own on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Column-level grant: users may only ever change display fields, never
-- `status` (suspension) or `email`, even though the row-level policy
-- above would otherwise let them update their own row.
revoke update on profiles from authenticated;
grant update (name, phone) on profiles to authenticated;

-- ============================================================
-- credits — no INSERT/UPDATE/DELETE policy for any client role, ever.
-- Absence of a policy for a command denies that command entirely under
-- RLS; only service_role (which bypasses RLS) can write here, via the
-- SECURITY DEFINER functions in 0004_credit_functions.sql.
-- ============================================================
alter table credits enable row level security;

create policy credits_select_own on credits
  for select using (auth.uid() = user_id);

create policy credits_select_admin on credits
  for select using (public.is_admin());

revoke insert, update, delete on credits from authenticated, anon;

-- ============================================================
-- credit_transactions — read-only ledger for every client role.
-- ============================================================
alter table credit_transactions enable row level security;

create policy credit_transactions_select_own on credit_transactions
  for select using (auth.uid() = user_id);

create policy credit_transactions_select_admin on credit_transactions
  for select using (public.is_admin());

revoke insert, update, delete on credit_transactions from authenticated, anon;

-- ============================================================
-- payments — user can submit (insert) and read their own; admin reads all.
-- Approval/rejection status changes happen only via the SECURITY DEFINER
-- function in 0004 (service_role), never a direct client UPDATE.
-- ============================================================
alter table payments enable row level security;

create policy payments_select_own on payments
  for select using (auth.uid() = user_id);

create policy payments_select_admin on payments
  for select using (public.is_admin());

create policy payments_insert_own on payments
  for insert with check (auth.uid() = user_id and status = 'pending');

revoke update, delete on payments from authenticated, anon;

-- ============================================================
-- tool_usage — read-only for every client role; rows are written only
-- from inside the SECURITY DEFINER credit-settlement functions.
-- ============================================================
alter table tool_usage enable row level security;

create policy tool_usage_select_own on tool_usage
  for select using (auth.uid() = user_id);

create policy tool_usage_select_admin on tool_usage
  for select using (public.is_admin());

revoke insert, update, delete on tool_usage from authenticated, anon;

-- ============================================================
-- admin_users — a user may check their own membership; nothing else.
-- No self-serve admin creation from any client role.
-- ============================================================
alter table admin_users enable row level security;

create policy admin_users_select_own on admin_users
  for select using (auth.uid() = user_id);

revoke insert, update, delete on admin_users from authenticated, anon;

-- ============================================================
-- pricing_plans — active packs visible to signed-in users for display;
-- writes happen only via service_role (no admin pricing-editing UI in
-- MVP scope per PRD.md — seeded/updated via migration or direct admin
-- access only).
-- ============================================================
alter table pricing_plans enable row level security;

create policy pricing_plans_select_active on pricing_plans
  for select using (active = true);

create policy pricing_plans_select_admin on pricing_plans
  for select using (public.is_admin());

revoke insert, update, delete on pricing_plans from authenticated, anon;

-- ============================================================
-- tool_pricing — visible to signed-in users so the UI can show cost
-- before running a tool; writes only via service_role.
-- ============================================================
alter table tool_pricing enable row level security;

create policy tool_pricing_select_all on tool_pricing
  for select using (auth.role() = 'authenticated');

revoke insert, update, delete on tool_pricing from authenticated, anon;
