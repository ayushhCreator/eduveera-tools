-- Non-concurrent verification of schema, trigger, constraints, RLS, and
-- the credit-mutation functions. Fails loudly on any unmet assertion;
-- psql -v ON_ERROR_STOP=1 makes that abort the script with a nonzero
-- exit code.
--
-- Assertions are plain top-level `select assert(...)` / `select
-- expect_error(...)` calls rather than ad-hoc `do $$ ... $$` blocks,
-- because psql's `:variable` substitution does not reach inside
-- dollar-quoted bodies (it would collide with plpgsql's `:=`) — so a
-- captured psql variable referenced inside a DO block is sent to the
-- server as a literal, unsubstituted `:name` and fails to parse.

\set ON_ERROR_STOP on

create or replace function assert(cond boolean, msg text) returns void
language plpgsql as $$
begin
  if not cond then
    raise exception 'ASSERTION FAILED: %', msg;
  end if;
  raise notice 'PASS: %', msg;
end;
$$;

create or replace function expect_error(query text, expected_sqlstate text, expected_message text default null) returns void
language plpgsql as $$
begin
  begin
    execute query;
  exception
    when others then
      if sqlstate <> expected_sqlstate then
        raise exception 'ASSERTION FAILED: expected sqlstate % but got % (%)', expected_sqlstate, sqlstate, sqlerrm;
      end if;
      if expected_message is not null and sqlerrm <> expected_message then
        raise exception 'ASSERTION FAILED: expected message % but got %', expected_message, sqlerrm;
      end if;
      raise notice 'PASS: got expected error % (%)', coalesce(expected_message, expected_sqlstate), query;
      return;
  end;
  raise exception 'ASSERTION FAILED: expected error % but call succeeded (%)', coalesce(expected_message, expected_sqlstate), query;
end;
$$;

grant execute on function assert(boolean, text) to public;
grant execute on function expect_error(text, text, text) to public;

-- ------------------------------------------------------------
-- 1. auth.users trigger creates profiles + credits(balance=0)
-- ------------------------------------------------------------
insert into auth.users (email) values ('user1@example.com') returning id as user1_id \gset
insert into auth.users (email) values ('user2@example.com') returning id as user2_id \gset
insert into auth.users (email) values ('admin1@example.com') returning id as admin1_id \gset

select assert(
  exists (select 1 from profiles where id = :'user1_id'::uuid and email = 'user1@example.com'),
  'trigger creates profiles row'
);
select assert(
  exists (select 1 from credits where user_id = :'user1_id'::uuid and balance = 0),
  'trigger creates credits row with balance 0'
);

insert into admin_users (user_id) values (:'admin1_id'::uuid);

-- ------------------------------------------------------------
-- 2. non-negative balance check constraint
-- ------------------------------------------------------------
select expect_error(
  format('update credits set balance = -1 where user_id = %L::uuid', :'user1_id'),
  '23514' -- check_violation
);

-- ------------------------------------------------------------
-- 3. unique UTR constraint
-- ------------------------------------------------------------
insert into pricing_plans (label, price_inr, credits) values ('test pack', 10.00, 10) returning id as plan_id \gset

insert into payments (user_id, pricing_plan_id, amount_inr, credits_requested, utr)
values (:'user1_id'::uuid, :'plan_id'::uuid, 10.00, 10, 'UTR-DUPLICATE-TEST');

select expect_error(
  format(
    'insert into payments (user_id, pricing_plan_id, amount_inr, credits_requested, utr) values (%L::uuid, %L::uuid, 10.00, 10, %L)',
    :'user2_id', :'plan_id', 'UTR-DUPLICATE-TEST'
  ),
  '23505' -- unique_violation
);

-- ------------------------------------------------------------
-- 4. RLS: authenticated role cannot write credits directly, and can
--    only see its own row.
-- ------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'user1_id', false);

select expect_error(
  format('update credits set balance = 999 where user_id = %L::uuid', :'user1_id'),
  '42501' -- insufficient_privilege — column/table UPDATE grant was revoked
);

select assert(
  (select count(*) from credits) = 1,
  'RLS restricts credits SELECT to own row'
);

reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ------------------------------------------------------------
-- 5. settle_tool_usage: insufficient balance blocks debit, no ledger row
-- ------------------------------------------------------------
set role service_role;

select expect_error(
  format(
    'select settle_tool_usage(%L::uuid, %L, %L, %L::jsonb)',
    :'user1_id', 'hindi_converter', 'success', '{}'
  ),
  'P0001', 'insufficient_credits'
);

reset role;

select assert(
  (select balance from credits where user_id = :'user1_id'::uuid) = 0,
  'blocked debit left balance untouched'
);

-- ------------------------------------------------------------
-- 6. admin_adjust_credits: validation + happy path
-- ------------------------------------------------------------
set role service_role;

select expect_error(
  format('select admin_adjust_credits(%L::uuid, %L::uuid, 0, %L)', :'user1_id', :'admin1_id', 'test'),
  'P0001', 'zero_amount'
);

select expect_error(
  format('select admin_adjust_credits(%L::uuid, %L::uuid, 10, %L)', :'user1_id', :'admin1_id', ''),
  'P0001', 'reason_required'
);

select new_balance as after_grant from admin_adjust_credits(:'user1_id'::uuid, :'admin1_id'::uuid, 10, 'test grant') \gset

select assert(:after_grant = 10, format('expected balance 10 after grant, got %s', :after_grant));
select assert(
  exists (
    select 1 from credit_transactions
    where user_id = :'user1_id'::uuid and type = 'credit' and amount = 10 and created_by = :'admin1_id'::uuid
  ),
  'admin adjustment creates a ledger row'
);

reset role;

-- ------------------------------------------------------------
-- 7. settle_tool_usage happy path debits exactly tool_pricing.cost_credits
--    and 'failed' status never debits.
-- ------------------------------------------------------------
set role service_role;

select new_balance, credits_charged from settle_tool_usage(:'user1_id'::uuid, 'hindi_converter', 'success', '{"direction":"kruti_to_unicode"}'::jsonb) \gset

select assert(:credits_charged = 1, format('expected hindi_converter cost 1, charged %s', :credits_charged));
select assert(:new_balance = 9, format('expected balance 9 after debit, got %s', :new_balance));

select new_balance as balance_after_fail, credits_charged as charged_on_fail
from settle_tool_usage(:'user1_id'::uuid, 'hindi_converter', 'failed', '{}'::jsonb) \gset

select assert(:charged_on_fail = 0, format('failed tool usage charged %s credits', :charged_on_fail));
select assert(:balance_after_fail = 9, format('balance changed on failed tool usage (now %s)', :balance_after_fail));

reset role;

-- ------------------------------------------------------------
-- 8. payment approval: happy path + idempotency (sequential double-call)
-- ------------------------------------------------------------
insert into payments (user_id, pricing_plan_id, amount_inr, credits_requested, utr)
values (:'user2_id'::uuid, :'plan_id'::uuid, 10.00, 10, 'UTR-APPROVE-TEST') returning id as payment_id \gset

set role service_role;

select new_balance, credits_granted from approve_payment(:'payment_id'::uuid, :'admin1_id'::uuid) \gset

select assert(:credits_granted = 10, format('expected 10 credits granted, got %s', :credits_granted));
select assert(:new_balance = 10, format('expected balance 10 after approval, got %s', :new_balance));

select expect_error(
  format('select approve_payment(%L::uuid, %L::uuid)', :'payment_id', :'admin1_id'),
  'P0001', 'payment_not_pending'
);

select assert(
  (select balance from credits where user_id = :'user2_id'::uuid) = 10,
  'double-approval did not change balance'
);
select assert(
  (select count(*) from credit_transactions where reference = :'payment_id') = 1,
  'exactly one ledger row exists for the approved payment'
);

reset role;

-- ------------------------------------------------------------
-- 9. reject_payment: no ledger row, idempotent
-- ------------------------------------------------------------
insert into payments (user_id, pricing_plan_id, amount_inr, credits_requested, utr)
values (:'user2_id'::uuid, :'plan_id'::uuid, 10.00, 10, 'UTR-REJECT-TEST') returning id as reject_payment_id \gset

set role service_role;
select reject_payment(:'reject_payment_id'::uuid, :'admin1_id'::uuid);

select assert(
  not exists (select 1 from credit_transactions where reference = :'reject_payment_id'),
  'rejection creates no credit_transactions row'
);

reset role;

\echo 'ALL SEQUENTIAL ASSERTIONS PASSED'
