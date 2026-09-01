# Eduveera Tools — Database Design

PostgreSQL via Supabase. All tables below are the canonical schema — every other doc (API.md, ARCHITECTURE.md, SECURITY.md, TODO.md) references these exact table and column names. `profiles`, `credits`, `credit_transactions`, `payments`, and `tool_usage` are required by the brief (Section 8). `admin_users` and `pricing_plans`/`tool_pricing` are **[Technical Recommendation]** additions needed to satisfy "admin login" and "pricing must be configurable" — the brief names them as the minimum table set to build toward, not a literal exhaustive list.

## Core invariant

`credits.balance` for a user must always equal `SUM(credit_transactions.amount)` for that user (credits positive, debits negative). This is enforced by making `credits.balance` a value that is **only ever updated in the same DB transaction** that inserts the corresponding `credit_transactions` row (see [ARCHITECTURE.md](ARCHITECTURE.md) § Credit Architecture, [API.md](API.md)). Never update one without the other.

## 1. `profiles`

Extends Supabase Auth's `auth.users` (1:1, same primary key). Do not duplicate auth fields beyond what's needed for display/admin search.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, FK → `auth.users(id)` on delete cascade | Same id as the Supabase Auth user. |
| `name` | `text` | nullable | Display name. |
| `email` | `text` | not null, unique | Mirrored from auth for admin search convenience. |
| `phone` | `text` | nullable, unique | Optional. |
| `status` | `text` | not null, default `'active'`, check in (`'active'`,`'suspended'`) | Suspended users blocked from tool actions server-side. |
| `created_at` | `timestamptz` | not null, default `now()` | |

Trigger: on `auth.users` insert → insert matching `profiles` row **and** a `credits` row with `balance = 0` (same transaction, via a Postgres trigger function so it can never be skipped from application code).

## 2. `credits`

One row per user. Current balance only — history lives in `credit_transactions`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `user_id` | `uuid` | PK, FK → `profiles(id)` on delete cascade | |
| `balance` | `integer` | not null, default `0`, check (`balance >= 0`) | Whole credits; no fractional credits. |
| `updated_at` | `timestamptz` | not null, default `now()` | Bumped on every mutation. |

`balance >= 0` check constraint is the last line of defense against a bug ever pushing a user negative — deduction logic must pre-check sufficiency before committing (see API.md).

## 3. `credit_transactions`

The ledger. Append-only — rows are never updated or deleted (audit requirement from the brief).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `user_id` | `uuid` | not null, FK → `profiles(id)` | Indexed. |
| `type` | `text` | not null, check in (`'credit'`,`'debit'`) | Sign is also encoded in `amount` for easy `SUM()`; `type` is for readability/filtering. |
| `amount` | `integer` | not null, check (`amount <> 0`) | Positive for credit, negative for debit. `SUM(amount)` per user = `credits.balance`. |
| `reason` | `text` | not null | e.g. `'tool_usage:image_compressor'`, `'payment_approved'`, `'admin_adjustment'`. |
| `reference` | `text` | nullable | Free-form pointer to source row, e.g. `tool_usage.id` or `payments.id` (see below on why not a hard FK). |
| `balance_after` | `integer` | not null | Snapshot of `credits.balance` immediately after this row — cheap tamper-evidence / audit readability without recomputation. |
| `created_by` | `uuid` | nullable, FK → `profiles(id)` | Set for admin-initiated adjustments (who did it); null for system-initiated (tool usage debit). |
| `created_at` | `timestamptz` | not null, default `now()` | Indexed (admin history views, sorted). |

**Indexes:** `(user_id, created_at desc)` for per-user history; `(created_at desc)` for admin global feed.

**Why `reference` is not a single FK:** it can point to either `tool_usage.id` or `payments.id` depending on `reason`. A polymorphic FK adds constraint complexity for no real safety gain in an append-only ledger; keep it as an indexed free-text pointer. **[Technical Recommendation]**

## 4. `payments`

One row per UTR submission (manual flow) or gateway payment attempt (future).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `user_id` | `uuid` | not null, FK → `profiles(id)` | Indexed. |
| `pricing_plan_id` | `uuid` | not null, FK → `pricing_plans(id)` | Which credit pack was purchased. |
| `amount_inr` | `numeric(10,2)` | not null | Amount the user claims to have paid. |
| `credits_requested` | `integer` | not null | Credits the pack grants; copied at submission time so later pack edits don't retroactively change a pending request. |
| `utr` | `text` | nullable, **unique** | UPI transaction reference. Unique constraint prevents the same UTR being submitted twice (duplicate-transaction / replay defense). |
| `gateway_payment_id` | `text` | nullable, unique | Reserved for future Razorpay integration; null in MVP manual flow. |
| `status` | `text` | not null, default `'pending'`, check in (`'pending'`,`'approved'`,`'rejected'`) | |
| `reviewed_by` | `uuid` | nullable, FK → `profiles(id)` | Admin who approved/rejected. |
| `reviewed_at` | `timestamptz` | nullable | |
| `created_at` | `timestamptz` | not null, default `now()` | |

**Constraint:** `check (utr is not null or gateway_payment_id is not null)` — a payment row must have at least one external reference.

**Indexes:** `(status, created_at)` for the admin "pending queue" view; unique index on `utr` (where not null); unique index on `gateway_payment_id` (where not null).

**Approval idempotency:** approving must be guarded by `status = 'pending'` in the same statement/transaction that flips it to `'approved'` and inserts the `credit_transactions` row, so double-clicking "approve" (or a race between two admin tabs) cannot double-credit. See [SECURITY.md](SECURITY.md) § Payment Replay & UTR Approval.

## 5. `tool_usage`

One row per tool invocation attempt (success or failure) — also the source for admin's "basic tool-usage count."

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `user_id` | `uuid` | not null, FK → `profiles(id)` | Indexed. |
| `tool` | `text` | not null, check in (`'image_compressor'`,`'passport_photo'`,`'hindi_converter'`) | Smart Detection is not logged here — it's not a billable/processing action (see PRD § 7). |
| `status` | `text` | not null, check in (`'success'`,`'failed'`) | |
| `credits_charged` | `integer` | not null, default `0` | 0 when `status = 'failed'` — enforced in application logic, not just convention. |
| `metadata` | `jsonb` | nullable | Tool-specific detail, e.g. `{"direction":"kruti_to_unicode"}`, `{"preset":"under_100kb","original_kb":812,"final_kb":94}`. Never store file contents here. |
| `created_at` | `timestamptz` | not null, default `now()` | Indexed. |

**Indexes:** `(tool, created_at desc)` for admin usage counts; `(user_id, created_at desc)` for per-user history.

## 6. `admin_users` — **[Technical Recommendation]**

Brief requires "admin login" but doesn't specify the access model. A dedicated table (rather than a `role` column on `profiles`) keeps RLS policies simple: policies can check `EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())` without touching the public-facing `profiles` table's policy set. Simpler alternative considered: a `role` enum column directly on `profiles` — rejected only because it would require every `profiles` RLS policy to also reason about role, whereas a separate table isolates the concern. Either is valid; this doc picks the table.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `user_id` | `uuid` | PK, FK → `profiles(id)` on delete cascade | |
| `role` | `text` | not null, default `'admin'` | Single role in MVP; column exists so a future `'support'`-type role doesn't require a schema change. |
| `created_at` | `timestamptz` | not null, default `now()` | |

Admin accounts are provisioned by inserting directly into this table (via Supabase SQL editor / a one-off script) — there is no self-serve "become admin" flow. See [SECURITY.md](SECURITY.md) § Admin Authorization.

## 7. `pricing_plans` — **[Technical Recommendation]**

Configurable ₹-to-credits packs for the UPI/UTR purchase flow. Satisfies "pricing must be configurable, not hard-coded."

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `label` | `text` | not null | e.g. `"₹99 — 50 credits"`. |
| `price_inr` | `numeric(10,2)` | not null, check (`price_inr > 0`) | |
| `credits` | `integer` | not null, check (`credits > 0`) | |
| `active` | `boolean` | not null, default `true` | Inactive packs hidden from purchase UI but retained for historical `payments` FK integrity. |
| `created_at` | `timestamptz` | not null, default `now()` | |

## 8. `tool_pricing` — **[Technical Recommendation]**

Configurable per-tool credit cost. Split from `pricing_plans` rather than overloaded into one polymorphic table — two small single-purpose tables are simpler to reason about and query than one table with type-dependent nullable columns.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `tool` | `text` | PK, check in (`'image_compressor'`,`'passport_photo'`,`'hindi_converter'`) | |
| `cost_credits` | `integer` | not null, check (`cost_credits >= 0`) | Read server-side at the start of every tool action; never trust a client-supplied cost. |
| `updated_at` | `timestamptz` | not null, default `now()` | |

Actual costs are not specified in the brief — seed with placeholder values and confirm with the client (tracked in [TODO.md](TODO.md)).

## Relationships

```
auth.users (Supabase-managed)
   └─1:1─ profiles
             ├─1:1─ credits
             ├─1:N─ credit_transactions
             ├─1:N─ payments ──N:1── pricing_plans
             ├─1:N─ tool_usage
             └─0:1─ admin_users
```

## Transaction requirements

- **Tool usage debit:** insert `tool_usage` (status='success') + insert `credit_transactions` (debit) + update `credits.balance` — one DB transaction (`SERIALIZABLE` or `SELECT ... FOR UPDATE` on the `credits` row to prevent concurrent double-spend). Failed tool actions insert only `tool_usage` (status='failed'), no ledger row, no balance change.
- **Payment approval:** update `payments.status` (guarded by `WHERE status = 'pending'`) + insert `credit_transactions` (credit) + update `credits.balance` — one transaction. If the guarded update affects 0 rows (already approved/rejected), abort — this is the idempotency mechanism.
- **Admin manual adjustment:** insert `credit_transactions` (type reflects sign, `created_by` = admin id) + update `credits.balance` — one transaction.

All three are implemented as Postgres functions (`SECURITY DEFINER`, called only from trusted server code) or equivalent server-side transactional logic — never as separate client-visible steps. See [ARCHITECTURE.md](ARCHITECTURE.md) § Credit Architecture.

## Row Level Security summary

Full detail in [SECURITY.md](SECURITY.md). Summary:
- `profiles`, `credits`, `credit_transactions`, `payments`, `tool_usage`: users can `SELECT` their own rows only. No client-side `INSERT`/`UPDATE`/`DELETE` on `credits` or `credit_transactions` ever — those only happen via server-side service-role logic.
- `admin_users`, `pricing_plans`, `tool_pricing`: readable by admins (and `pricing_plans`/`tool_pricing` readable by all authenticated users for display purposes, e.g. showing tool cost before running it); writable only via service role.
