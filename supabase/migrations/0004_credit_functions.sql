-- The only three ways credits.balance / credit_transactions may ever change,
-- per ARCHITECTURE.md § 6 and DATABASE.md § Transaction requirements.
-- Each function is SECURITY DEFINER and EXECUTE is granted only to
-- service_role — callable exclusively from trusted server-side code
-- (Next.js Server Actions using the service-role Supabase client), never
-- directly from a browser session. This is what makes "credits never
-- change client-side" a database-enforced guarantee, not just an app
-- convention.

-- ============================================================
-- 1. Tool-usage settlement (Phase 4 / API.md recordToolResult, convertHindiText)
-- ============================================================
create function public.settle_tool_usage(
  p_user_id uuid,
  p_tool text,
  p_status text,
  p_metadata jsonb default null
)
returns table (new_balance integer, credits_charged integer, tool_usage_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_cost integer;
  v_new_balance integer;
  v_tool_usage_id uuid;
begin
  if p_status not in ('success', 'failed') then
    raise exception 'invalid_status';
  end if;

  if p_status = 'failed' then
    insert into tool_usage (user_id, tool, status, credits_charged, metadata)
    values (p_user_id, p_tool, 'failed', 0, p_metadata)
    returning id into v_tool_usage_id;

    select balance into v_balance from credits where user_id = p_user_id;

    return query select v_balance, 0, v_tool_usage_id;
    return;
  end if;

  -- status = 'success': lock the balance row before deciding whether
  -- there's enough to debit, so two concurrent debits can't both read a
  -- stale sufficient balance (SECURITY.md § 6).
  select balance into v_balance from credits where user_id = p_user_id for update;
  if not found then
    raise exception 'user_not_found';
  end if;

  select cost_credits into v_cost from tool_pricing where tool = p_tool;
  if not found then
    raise exception 'unknown_tool';
  end if;

  if v_balance < v_cost then
    -- log the attempt for observability, but no success row, no debit.
    insert into tool_usage (user_id, tool, status, credits_charged, metadata)
    values (p_user_id, p_tool, 'failed', 0, p_metadata);
    raise exception 'insufficient_credits';
  end if;

  update credits set balance = balance - v_cost, updated_at = now()
  where user_id = p_user_id
  returning balance into v_new_balance;

  insert into tool_usage (user_id, tool, status, credits_charged, metadata)
  values (p_user_id, p_tool, 'success', v_cost, p_metadata)
  returning id into v_tool_usage_id;

  insert into credit_transactions (user_id, type, amount, reason, reference, balance_after)
  values (p_user_id, 'debit', -v_cost, 'tool_usage:' || p_tool, v_tool_usage_id::text, v_new_balance);

  return query select v_new_balance, v_cost, v_tool_usage_id;
end;
$$;

revoke execute on function public.settle_tool_usage(uuid, text, text, jsonb) from public;
grant execute on function public.settle_tool_usage(uuid, text, text, jsonb) to service_role;

-- ============================================================
-- 2. Payment approval (Phase 14 / API.md adminApprovePayment)
-- ============================================================
create function public.approve_payment(
  p_payment_id uuid,
  p_admin_id uuid
)
returns table (new_balance integer, credits_granted integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_credits integer;
  v_new_balance integer;
begin
  -- The WHERE status = 'pending' guard is the whole idempotency
  -- mechanism: a retried call, a double-click, or a race between two
  -- admin sessions all resolve to "first one wins, rest affect 0 rows."
  update payments
  set status = 'approved', reviewed_by = p_admin_id, reviewed_at = now()
  where id = p_payment_id and status = 'pending'
  returning user_id, credits_requested into v_user_id, v_credits;

  if not found then
    raise exception 'payment_not_pending';
  end if;

  update credits set balance = balance + v_credits, updated_at = now()
  where user_id = v_user_id
  returning balance into v_new_balance;

  insert into credit_transactions (user_id, type, amount, reason, reference, balance_after, created_by)
  values (v_user_id, 'credit', v_credits, 'payment_approved', p_payment_id::text, v_new_balance, p_admin_id);

  return query select v_new_balance, v_credits;
end;
$$;

revoke execute on function public.approve_payment(uuid, uuid) from public;
grant execute on function public.approve_payment(uuid, uuid) to service_role;

-- ============================================================
-- 3. Payment rejection (Phase 14 / API.md adminRejectPayment)
-- No credit_transactions row is ever created for a rejection.
-- ============================================================
create function public.reject_payment(
  p_payment_id uuid,
  p_admin_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update payments
  set status = 'rejected', reviewed_by = p_admin_id, reviewed_at = now()
  where id = p_payment_id and status = 'pending';

  if not found then
    raise exception 'payment_not_pending';
  end if;
end;
$$;

revoke execute on function public.reject_payment(uuid, uuid) from public;
grant execute on function public.reject_payment(uuid, uuid) to service_role;

-- ============================================================
-- 4. Admin manual adjustment (Phase 13 / API.md adminAdjustCredits)
-- ============================================================
create function public.admin_adjust_credits(
  p_user_id uuid,
  p_admin_id uuid,
  p_amount integer,
  p_reason text
)
returns table (new_balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_new_balance integer;
  v_type text;
begin
  if p_amount = 0 then
    raise exception 'zero_amount';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason_required';
  end if;

  select balance into v_balance from credits where user_id = p_user_id for update;
  if not found then
    raise exception 'user_not_found';
  end if;

  if v_balance + p_amount < 0 then
    raise exception 'insufficient_balance';
  end if;

  update credits set balance = balance + p_amount, updated_at = now()
  where user_id = p_user_id
  returning balance into v_new_balance;

  v_type := case when p_amount > 0 then 'credit' else 'debit' end;

  insert into credit_transactions (user_id, type, amount, reason, reference, balance_after, created_by)
  values (p_user_id, v_type, p_amount, p_reason, null, v_new_balance, p_admin_id);

  return query select v_new_balance;
end;
$$;

revoke execute on function public.admin_adjust_credits(uuid, uuid, integer, text) from public;
grant execute on function public.admin_adjust_credits(uuid, uuid, integer, text) to service_role;
